import { supabase } from './lib/supabase';

class RecommendationEngine {
    constructor(userId) {
        this.userId = userId;
        this.cacheExpiry = 3600000; // 1 hour cache
    }

    // Track user behavior for better recommendations
    async trackBehavior(productId, behaviorType, searchTerm = null) {
        try {
            await supabase.rpc('track_user_behavior', {
                p_user_id: this.userId,
                p_product_id: productId,
                p_behavior_type: behaviorType,
                p_search_term: searchTerm
            });
        } catch (error) {
            console.error('Error tracking behavior:', error);
        }
    }

    // Get personalized recommendations
    async getPersonalizedRecommendations(limit = 10) {
        // Check cache first
        const cached = await this.getCachedRecommendations('personalized');
        if (cached) return cached;

        try {
            // Get user's interests and behavior
            const [userProfile, userSearches, userSaves, userViews] = await Promise.all([
                this.getUserProfile(),
                this.getUserSearches(),
                this.getUserSavedItems(),
                this.getUserViewedProducts()
            ]);

            // Extract keywords from user behavior
            const keywords = this.extractKeywords(userProfile, userSearches, userSaves);
            
            // Build recommendation query based on keywords
            let query = supabase
                .from('products')
                .select(`
                    *,
                    profiles!seller_id (
                        username,
                        location,
                        rating
                    )
                `)
                .neq('seller_id', this.userId)
                .limit(limit);

            // Add keyword filters if available
            if (keywords.length > 0) {
                const orConditions = keywords
                    .slice(0, 5)
                    .map(k => `name.ilike.%${k}%`)
                    .join(',');
                query = query.or(orConditions);
            }

            // Add collaborative filtering (products liked by similar users)
            const similarUsers = await this.getSimilarUsers();
            if (similarUsers.length > 0) {
                const { data: collabProducts } = await supabase
                    .from('saved_items')
                    .select('product_id, products(*)')
                    .in('user_id', similarUsers)
                    .not('product_id', 'in', userSaves.map(s => s.product_id).filter(Boolean))
                    .limit(limit);

                if (collabProducts && collabProducts.length > 0) {
                    const recommendations = collabProducts.map(c => c.products);
                    await this.cacheRecommendations('personalized', recommendations);
                    return recommendations;
                }
            }

            const { data: recommendations, error } = await query;
            
            if (!error && recommendations) {
                // Sort by relevance score
                const scored = this.scoreRecommendations(recommendations, userSaves, userViews);
                const sorted = scored.sort((a, b) => b.score - a.score).slice(0, limit);
                
                await this.cacheRecommendations('personalized', sorted);
                return sorted;
            }

            return [];

        } catch (error) {
            console.error('Error getting recommendations:', error);
            return this.getFallbackRecommendations(limit);
        }
    }

    // Get similar products based on current product
    async getSimilarProducts(productId, limit = 6) {
        try {
            // First, try to get from similarity table
            const { data: similar, error } = await supabase
                .from('product_similarity')
                .select(`
                    product_id_2,
                    similarity_score,
                    products:product_id_2 (*)
                `)
                .eq('product_id_1', productId)
                .order('similarity_score', { ascending: false })
                .limit(limit);

            if (!error && similar && similar.length > 0) {
                return similar.map(s => ({
                    ...s.products,
                    similarity_score: s.similarity_score
                }));
            }

            // Fallback: Find products with similar names/categories
            const { data: currentProduct } = await supabase
                .from('products')
                .select('name, category')
                .eq('id', productId)
                .single();

            if (currentProduct) {
                const keywords = currentProduct.name.split(' ').slice(0, 3);
                const { data: fallback } = await supabase
                    .from('products')
                    .select('*')
                    .neq('id', productId)
                    .or(keywords.map(k => `name.ilike.%${k}%`).join(','))
                    .limit(limit);

                return fallback || [];
            }

            return [];

        } catch (error) {
            console.error('Error getting similar products:', error);
            return [];
        }
    }

    // Get trending products
    async getTrendingProducts(limit = 10) {
        const cached = await this.getCachedRecommendations('trending');
        if (cached) return cached;

        try {
            const { data: trending, error } = await supabase
                .rpc('get_trending_products', { limit_count: limit });

            if (!error && trending) {
                await this.cacheRecommendations('trending', trending);
                return trending;
            }

            // Fallback: Get most viewed products
            const { data: fallback } = await supabase
                .from('products')
                .select('*, profiles(username, location)')
                .order('views', { ascending: false })
                .limit(limit);

            return fallback || [];

        } catch (error) {
            console.error('Error getting trending:', error);
            return [];
        }
    }

    // Get "frequently bought together" recommendations
    async getFrequentlyBoughtTogether(productId, limit = 4) {
        try {
            const { data: combinations } = await supabase
                .from('user_behavior')
                .select('product_id')
                .eq('behavior_type', 'contact')
                .in('product_id', 
                    supabase
                        .from('user_behavior')
                        .select('product_id')
                        .eq('product_id', productId)
                )
                .limit(limit * 2);

            if (combinations && combinations.length > 0) {
                const productIds = [...new Set(combinations.map(c => c.product_id))];
                const { data: products } = await supabase
                    .from('products')
                    .select('*')
                    .in('id', productIds)
                    .neq('id', productId)
                    .limit(limit);

                return products || [];
            }

            return [];

        } catch (error) {
            console.error('Error getting bought together:', error);
            return [];
        }
    }

    // Helper methods
    async getUserProfile() {
        const { data } = await supabase
            .from('profiles')
            .select('interests, location')
            .eq('user_id', this.userId)
            .single();
        return data;
    }

    async getUserSearches() {
        const { data } = await supabase
            .from('searches')
            .select('product_name')
            .eq('buyer_id', this.userId)
            .order('created_at', { ascending: false })
            .limit(20);
        return data || [];
    }

    async getUserSavedItems() {
        const { data } = await supabase
            .from('saved_items')
            .select('product_id, product_name')
            .eq('user_id', this.userId)
            .eq('item_type', 'product');
        return data || [];
    }

    async getUserViewedProducts() {
        const { data } = await supabase
            .from('user_behavior')
            .select('product_id')
            .eq('user_id', this.userId)
            .eq('behavior_type', 'view')
            .order('created_at', { ascending: false })
            .limit(30);
        return data || [];
    }

    async getSimilarUsers() {
        const userSaves = await this.getUserSavedItems();
        const savedProductIds = userSaves.map(s => s.product_id);
        
        if (savedProductIds.length === 0) return [];

        const { data } = await supabase
            .from('saved_items')
            .select('user_id')
            .in('product_id', savedProductIds)
            .neq('user_id', this.userId)
            .limit(10);

        return [...new Set(data?.map(d => d.user_id) || [])];
    }

    extractKeywords(profile, searches, saves) {
        const keywords = new Set();
        
        // Add interests from profile
        if (profile?.interests) {
            const interests = Array.isArray(profile.interests) 
                ? profile.interests 
                : JSON.parse(profile.interests || '[]');
            interests.forEach(i => keywords.add(i.toLowerCase()));
        }
        
        // Add search terms
        searches.forEach(s => {
            if (s.product_name) {
                s.product_name.split(' ').forEach(word => {
                    if (word.length > 2) keywords.add(word.toLowerCase());
                });
            }
        });
        
        // Add saved product names
        saves.forEach(s => {
            if (s.product_name) {
                s.product_name.split(' ').forEach(word => {
                    if (word.length > 2) keywords.add(word.toLowerCase());
                });
            }
        });
        
        return Array.from(keywords);
    }

    scoreRecommendations(products, savedItems, viewedItems) {
        const savedIds = new Set(savedItems.map(s => s.product_id));
        const viewedIds = new Set(viewedItems.map(v => v.product_id));
        
        return products.map(product => {
            let score = 0;
            
            // Higher score for products similar to saved ones
            if (savedIds.has(product.id)) score += 10;
            
            // Higher score for viewed but not saved
            if (viewedIds.has(product.id) && !savedIds.has(product.id)) score += 3;
            
            // Boost for products with good ratings
            if (product.profiles?.rating > 4) score += 2;
            
            // Boost for nearby products
            if (product.location === profileData?.location) score += 2;
            
            return { ...product, score };
        });
    }

    async getCachedRecommendations(type) {
        const { data } = await supabase
            .from('recommendations_cache')
            .select('recommended_products')
            .eq('user_id', this.userId)
            .eq('recommendation_type', type)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

        return data?.recommended_products || null;
    }

    async cacheRecommendations(type, recommendations) {
        await supabase
            .from('recommendations_cache')
            .upsert({
                user_id: this.userId,
                recommendation_type: type,
                recommended_products: recommendations,
                expires_at: new Date(Date.now() + this.cacheExpiry).toISOString()
            });
    }

    async getFallbackRecommendations(limit) {
        const { data } = await supabase
            .from('products')
            .select('*, profiles(username, location, rating)')
            .neq('seller_id', this.userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        return data || [];
    }
}

export default RecommendationEngine;