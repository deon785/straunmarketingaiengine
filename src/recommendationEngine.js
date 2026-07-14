// RecommendationEngine.jsx - OPTIMIZED FOR SPEED

import { supabase } from './lib/supabase';

const fetchWithRetry = async (fetchFn, maxRetries = 2) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await fetchFn();
            if (result?.error?.status === 400) {
                console.warn(`[Fetch] Query error (400):`, result.error.message);
                return result;
            }
            return result;
        } catch (err) {
            lastError = err;
            if (err?.status === 400 || err?.message?.includes('400')) {
                console.warn(`[Fetch] 400 error, not retrying:`, err.message);
                return { error: err, data: null };
            }
            console.warn(`Fetch attempt ${i + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
    throw lastError;
};

class RecommendationEngine {
    constructor(userId) {
        this.userId = userId;
        this.fetchedRef = false;
        this._cachedRecommendations = null;
        
        // ✅ LAYER 1: In-memory cache (fastest) - REDUCED TTL for fresher data
        this._memoryCache = {};
        this._memoryCacheTTL = 2 * 60 * 1000; // 2 minutes (was 5)
        
        // ✅ LAYER 2: LocalStorage cache (fast) - REDUCED SIZE
        this._cachePrefix = 'rec_cache';
        this._maxCacheSize = 2 * 1024 * 1024; // 2MB (was 5MB)
        this._maxAgeDays = 7; // 7 days (was 30)
        
        // ✅ SKIP auto-cleanup on init to speed up loading
        // this._autoCleanup(); // ← REMOVED - runs too slow
    }

    // ============================================
    // AUTO-CLEANUP: Lazy cleanup (only when needed)
    // ============================================
    
    _autoCleanup() {
        try {
            // ✅ Only run if cache is large
            const allKeys = Object.keys(localStorage);
            const cacheKeys = allKeys.filter(key => 
                key.startsWith(`${this._cachePrefix}_${this.userId}_`)
            );
            
            if (cacheKeys.length === 0 || cacheKeys.length < 5) return;
            
            // ✅ Quick check: only clean if > 5 items
            if (cacheKeys.length <= 5) return;
            
            console.log('🧹 Running lazy cleanup...');
            
            let totalSize = 0;
            let cacheItems = [];
            
            for (const key of cacheKeys) {
                try {
                    const value = localStorage.getItem(key);
                    if (value) {
                        const size = new Blob([value]).size;
                        totalSize += size;
                        const data = JSON.parse(value);
                        cacheItems.push({
                            key: key,
                            size: size,
                            timestamp: data.timestamp || 0,
                            productsCount: data.products?.length || 0
                        });
                    }
                } catch (e) {
                    // Skip invalid items
                }
            }
            
            // ✅ Only cleanup if exceeds limits
            if (totalSize <= this._maxCacheSize && cacheItems.length <= 5) return;
            
            // Sort oldest first
            cacheItems.sort((a, b) => a.timestamp - b.timestamp);
            
            // Remove oldest items until under limits
            let removedCount = 0;
            for (const item of cacheItems) {
                if (cacheItems.length - removedCount <= 3 && 
                    totalSize - item.size <= this._maxCacheSize * 0.5) {
                    break;
                }
                localStorage.removeItem(item.key);
                removedCount++;
                totalSize -= item.size;
            }
            
            if (removedCount > 0) {
                console.log(`✅ Cleaned ${removedCount} old cache items`);
            }
            
        } catch (error) {
            // Silent fail - don't slow down the app
        }
    }

    // ============================================
    // LAYER 1: IN-MEMORY CACHE (FASTEST)
    // ============================================
    
    getFromMemoryCache(type, limit) {
        const key = `${type}_${limit}`;
        const cached = this._memoryCache[key];
        
        if (cached) {
            if (Date.now() - cached.timestamp < this._memoryCacheTTL) {
                return cached.data;
            }
            delete this._memoryCache[key];
        }
        return null;
    }

    saveToMemoryCache(type, limit, data) {
        const key = `${type}_${limit}`;
        this._memoryCache[key] = {
            data: data,
            timestamp: Date.now()
        };
    }

    clearMemoryCache() {
        this._memoryCache = {};
    }

    // ============================================
    // LAYER 2: LOCALSTORAGE CACHE (FAST)
    // ============================================
    
    getFromLocalCache(type = 'personalized') {
        try {
            const cacheKey = `${this._cachePrefix}_${this.userId}_${type}`;
            const cached = localStorage.getItem(cacheKey);
            
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            
            if (data.expiresAt && Date.now() > data.expiresAt) {
                localStorage.removeItem(cacheKey);
                return null;
            }
            
            return data.products;
            
        } catch (error) {
            return null;
        }
    }

    saveToLocalCache(products, type = 'personalized') {
        try {
            // ✅ Compress data - only essential fields
            const compressed = products.slice(0, 20).map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                image: p.image_url,
                location: p.location,
                views: p.views,
                seller_id: p.seller_id
            }));
            
            const cacheData = {
                products: compressed,
                timestamp: Date.now(),
                expiresAt: Date.now() + (3 * 24 * 60 * 60 * 1000), // 3 days (was 7)
                version: '1.0'
            };
            
            const cacheKey = `${this._cachePrefix}_${this.userId}_${type}`;
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            
        } catch (error) {
            // Silent fail
        }
    }

    // ============================================
    // CORE METHODS WITH OPTIMIZED CACHING
    // ============================================

    // ✅ OPTIMIZED: Get personalized recommendations
    async getPersonalizedRecommendations(limit = 12) {
        // Check memory cache first
        const memoryData = this.getFromMemoryCache('personalized', limit);
        if (memoryData) return memoryData;

        // Check local cache
        const localData = this.getFromLocalCache('personalized');
        if (localData && localData.length > 0) {
            this.saveToMemoryCache('personalized', limit, localData);
            return localData;
        }

        if (!this.userId) return [];

        try {
            const [interests, behaviorKeywords] = await Promise.all([
                this.getUserInterests(),
                this.getUserBehaviorKeywords()
            ]);
            
            const allKeywords = [...interests, ...behaviorKeywords];
            const uniqueKeywords = [...new Set(allKeywords.filter(k => k && k.trim().length > 0))];
            
            let query = supabase
                .from('products')
                .select('*')
                .eq('status', 'active')
                .neq('seller_id', this.userId)
                .limit(limit);

            if (uniqueKeywords.length > 0) {
                const orConditions = uniqueKeywords
                    .slice(0, 10)
                    .map(k => `name.ilike.%${k.trim()}%`)
                    .join(',');
                query = query.or(orConditions);
            }

            const result = await fetchWithRetry(() => query);

            if (result?.error) {
                return this.getTrendingProducts(limit);
            }

            let products = [];
            if (result?.data && result.data.length > 0) {
                const sellerIds = [...new Set(result.data.map(p => p.seller_id).filter(Boolean))];
                let sellersMap = {};
                
                if (sellerIds.length > 0) {
                    const { data: sellers } = await supabase
                        .from('profiles')
                        .select('user_id, username, location')
                        .in('user_id', sellerIds);
                    
                    if (sellers) {
                        sellersMap = sellers.reduce((map, seller) => {
                            map[seller.user_id] = seller;
                            return map;
                        }, {});
                    }
                }

                products = result.data.map(product => ({
                    ...product,
                    profiles: sellersMap[product.seller_id] || null
                }));

                this.saveToLocalCache(products, 'personalized');
                this.saveToMemoryCache('personalized', limit, products);
                return products;
            }

            const trending = await this.getTrendingProducts(limit);
            if (trending && trending.length > 0) {
                this.saveToMemoryCache('personalized', limit, trending);
            }
            return trending;

        } catch (error) {
            const trending = await this.getTrendingProducts(limit);
            return trending || [];
        }
    }

    // ✅ OPTIMIZED: Get trending products
    async getTrendingProducts(limit = 10) {
        const memoryData = this.getFromMemoryCache('trending', limit);
        if (memoryData) return memoryData;

        const localData = this.getFromLocalCache('trending');
        if (localData && localData.length > 0) {
            this.saveToMemoryCache('trending', limit, localData);
            return localData;
        }

        if (!this.userId) return [];

        try {
            const { data: products, error } = await fetchWithRetry(() => supabase
                .from('products')
                .select('*')
                .eq('status', 'active')
                .order('views', { ascending: false })
                .limit(limit)
            );

            if (error || !products || products.length === 0) {
                return [];
            }

            const sellerIds = [...new Set(products.map(p => p.seller_id).filter(Boolean))];
            let sellersMap = {};
            
            if (sellerIds.length > 0) {
                const { data: sellers } = await supabase
                    .from('profiles')
                    .select('user_id, username, location')
                    .in('user_id', sellerIds);
                
                if (sellers) {
                    sellersMap = sellers.reduce((map, seller) => {
                        map[seller.user_id] = seller;
                        return map;
                    }, {});
                }
            }

            const result = products.map(product => ({
                ...product,
                profiles: sellersMap[product.seller_id] || null
            }));

            this.saveToLocalCache(result, 'trending');
            this.saveToMemoryCache('trending', limit, result);
            return result;

        } catch (error) {
            return [];
        }
    }

    // ✅ Get user interests - OPTIMIZED
    async getUserInterests() {
        if (!this.userId) return [];
        
        try {
            const { data, error } = await fetchWithRetry(() => supabase
                .from('profiles')
                .select('interests')
                .eq('user_id', this.userId)
                .maybeSingle()
            );
            
            if (error || !data?.interests) return [];
            
            let interests = [];
            if (Array.isArray(data.interests)) {
                interests = data.interests;
            } else if (typeof data.interests === 'string') {
                try {
                    interests = JSON.parse(data.interests);
                } catch (e) {
                    interests = [data.interests];
                }
            }
            
            return interests.filter(i => i && i.trim().length > 0).slice(0, 10);
        } catch (err) {
            return [];
        }
    }

    // ✅ Get user behavior keywords - OPTIMIZED
    async getUserBehaviorKeywords() {
        if (!this.userId) return [];
        
        try {
            const { data, error } = await fetchWithRetry(() => supabase
                .from('user_behavior')
                .select('search_term')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: false })
                .limit(20)
            );
            
            if (error || !data) return [];
            
            const keywords = new Set();
            data.forEach(record => {
                if (record.search_term) {
                    record.search_term.split(' ').forEach(word => {
                        if (word.length > 2) keywords.add(word.toLowerCase().trim());
                    });
                }
            });
            
            return Array.from(keywords).slice(0, 10);
        } catch (err) {
            return [];
        }
    }

    // ✅ Get alternative products - OPTIMIZED
    async getAlternativeProducts(searchTerm, limit = 10) {
        if (!this.userId || !searchTerm) {
            return this.getPersonalizedRecommendations(limit);
        }

        try {
            const keywords = searchTerm.split(' ').filter(w => w.length > 2).slice(0, 5);
            
            if (keywords.length === 0) {
                return this.getPersonalizedRecommendations(limit);
            }

            const orConditions = keywords
                .map(k => `name.ilike.%${k.trim()}%`)
                .join(',');

            let query = supabase
                .from('products')
                .select('*')
                .eq('status', 'active')
                .neq('seller_id', this.userId)
                .limit(limit);

            if (orConditions) {
                query = query.or(orConditions);
            }

            const { data: products, error } = await fetchWithRetry(() => query);

            if (error || !products || products.length === 0) {
                return this.getPersonalizedRecommendations(limit);
            }

            const sellerIds = [...new Set(products.map(p => p.seller_id).filter(Boolean))];
            let sellersMap = {};
            
            if (sellerIds.length > 0) {
                const { data: sellers } = await supabase
                    .from('profiles')
                    .select('user_id, username, location')
                    .in('user_id', sellerIds);
                
                if (sellers) {
                    sellersMap = sellers.reduce((map, seller) => {
                        map[seller.user_id] = seller;
                        return map;
                    }, {});
                }
            }

            return products.map(product => ({
                ...product,
                profiles: sellersMap[product.seller_id] || null,
                is_alternative: true
            }));

        } catch (error) {
            return this.getPersonalizedRecommendations(limit);
        }
    }

    // ✅ Get similar products - OPTIMIZED
    async getSimilarProducts(productId, limit = 6) {
        if (!this.userId || !productId) {
            return this.getPersonalizedRecommendations(limit);
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(productId)) {
            return this.getPersonalizedRecommendations(limit);
        }

        try {
            const { data: similarProducts, error } = await fetchWithRetry(() => supabase
                .from('product_similarity')
                .select(`
                    product_id_2, 
                    similarity_score, 
                    products:product_id_2 (
                        id,
                        name,
                        price,
                        location,
                        seller_id,
                        image_url,
                        profiles:seller_id (
                            user_id,
                            username,
                            location
                        )
                    )
                `)
                .eq('product_id_1', productId)
                .order('similarity_score', { ascending: false })
                .limit(limit)
            );

            if (error || !similarProducts || similarProducts.length === 0) {
                return this.getPersonalizedRecommendations(limit);
            }

            return similarProducts.map(item => ({
                ...item.products,
                similarity_score: item.similarity_score,
                is_similar: true
            }));

        } catch (error) {
            return this.getPersonalizedRecommendations(limit);
        }
    }

    // ✅ Get random products - OPTIMIZED
    async getRandomProducts(limit = 10) {
        if (!this.userId) return [];

        try {
            const { data: products, error } = await supabase
                .from('products')
                .select('*')
                .eq('status', 'active')
                .neq('seller_id', this.userId)
                .limit(limit)
                .order('created_at', { ascending: false });

            if (error || !products || products.length === 0) {
                return [];
            }

            return products;
        } catch (error) {
            return [];
        }
    }

    // ✅ Track behavior - OPTIMIZED (no await, fire and forget)
    async trackBehavior(productId, behaviorType, searchTerm = null) {
        if (!this.userId) return;

        try {
            // Fire and forget - don't wait for response
            supabase
                .from('user_behavior')
                .insert({
                    user_id: this.userId,
                    product_id: productId || null,
                    behavior_type: behaviorType,
                    search_term: searchTerm || null,
                    created_at: new Date().toISOString()
                })
                .then(() => {
                    // Success - do nothing
                })
                .catch(() => {
                    // Fail silently
                });
        } catch (error) {
            // Ignore errors
        }
    }

    // ✅ Clear ALL caches
    clearAllCaches() {
        this.clearMemoryCache();
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(`${this._cachePrefix}_${this.userId}_`)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            // Ignore
        }
        this.fetchedRef = false;
        this._cachedRecommendations = null;
    }

    // ✅ Get alternative prospects - OPTIMIZED
    async getAlternativeProspects(searchTerm, limit = 10) {
        if (!this.userId || !searchTerm) {
            return [];
        }

        try {
            const keywords = searchTerm.split(' ').filter(w => w.length > 2).slice(0, 5);
            
            if (keywords.length === 0) {
                return [];
            }

            const { data: allBuyers, error } = await fetchWithRetry(() => supabase
                .from('profiles')
                .select('user_id, username, location, interests, phone_number')
                .not('interests', 'is', null)
                .neq('user_id', this.userId)
                .eq('is_active', true)
                .limit(20)
            );

            if (error || !allBuyers || allBuyers.length === 0) {
                return [];
            }

            const { data: sellerProfile } = await supabase
                .from('profiles')
                .select('location')
                .eq('user_id', this.userId)
                .maybeSingle();
            
            const sellerLocation = sellerProfile?.location || '';

            const matchingBuyers = allBuyers.filter(buyer => {
                if (!buyer.interests) return false;
                
                let interests = [];
                if (Array.isArray(buyer.interests)) {
                    interests = buyer.interests;
                } else if (typeof buyer.interests === 'string') {
                    try {
                        interests = JSON.parse(buyer.interests);
                    } catch (e) {
                        interests = [buyer.interests];
                    }
                }
                
                return interests.some(interest => {
                    if (!interest) return false;
                    const interestLower = interest.toLowerCase();
                    return keywords.some(keyword => 
                        interestLower.includes(keyword.toLowerCase())
                    );
                });
            });

            const scoredBuyers = matchingBuyers.map(buyer => {
                let score = 0;
                let interests = [];
                if (Array.isArray(buyer.interests)) {
                    interests = buyer.interests;
                } else if (typeof buyer.interests === 'string') {
                    try {
                        interests = JSON.parse(buyer.interests);
                    } catch (e) {
                        interests = [buyer.interests];
                    }
                }
                
                const interestText = interests.join(' ').toLowerCase();
                keywords.forEach(keyword => {
                    if (interestText.includes(keyword.toLowerCase())) {
                        score += 1;
                    }
                });
                
                if (buyer.location && sellerLocation && 
                    buyer.location.toLowerCase() === sellerLocation.toLowerCase()) {
                    score += 3;
                }
                
                return { ...buyer, score, is_alternative: true };
            });

            const sorted = scoredBuyers.sort((a, b) => b.score - a.score);
            const limited = sorted.slice(0, limit);

            return limited.map(buyer => {
                let interests = [];
                if (Array.isArray(buyer.interests)) {
                    interests = buyer.interests;
                } else if (typeof buyer.interests === 'string') {
                    try {
                        interests = JSON.parse(buyer.interests);
                    } catch (e) {
                        interests = [buyer.interests];
                    }
                }
                
                return {
                    id: buyer.user_id,
                    email: buyer.username || 'User',
                    location: buyer.location || 'Location not specified',
                    interest: interests.slice(0, 3).join(', ') || searchTerm,
                    interests: interests,
                    phone_number: buyer.phone_number || '',
                    isSameLocation: buyer.location && sellerLocation && 
                        buyer.location.toLowerCase() === sellerLocation.toLowerCase(),
                    score: buyer.score,
                    is_alternative: true
                };
            });

        } catch (error) {
            return [];
        }
    }

    resetCache() {
        this.fetchedRef = false;
        this._cachedRecommendations = null;
        this.clearAllCaches();
    }
}

export default RecommendationEngine;