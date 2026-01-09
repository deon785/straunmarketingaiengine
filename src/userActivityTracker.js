// userActivityTracker.js
import { supabase } from './lib/supabase';

export class UserActivityTracker {
  static async trackActivity(userId, actionType, details = {}) {
    if (!userId) return;
    
    try {
      // Get user IP and user agent
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      
      const activity = {
        user_id: userId,
        action_type: actionType,
        target_id: details.targetId || null,
        target_type: details.targetType || null,
        details: details,
        ip_address: ipData.ip || null,
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      };
      
      // Update profile last activity
      await supabase
        .from('profiles')
        .update({ 
          last_activity_at: new Date().toISOString(),
          ...(actionType === 'search' && { total_searches: await this.incrementField(userId, 'total_searches') }),
          ...(actionType === 'contact' && { total_contacts: await this.incrementField(userId, 'total_contacts') })
        })
        .eq('user_id', userId);
      
      // Insert activity log
      await supabase
        .from('user_activities')
        .insert([activity]);
      
      console.log(`📊 Activity tracked: ${actionType} for user ${userId}`);
      
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  }
  
  static async incrementField(userId, field) {
    const { data } = await supabase
      .from('profiles')
      .select(field)
      .eq('user_id', userId)
      .single();
    
    return (data?.[field] || 0) + 1;
  }
  
  static async trackContact(senderId, receiverId, productId, contactType, success = true, error = null) {
    await this.trackActivity(senderId, 'contact', {
      targetId: receiverId,
      targetType: 'user',
      contactType,
      productId,
      success
    });
    
    // Log to contact_logs table
    await supabase
      .from('contact_logs')
      .insert([{
        sender_id: senderId,
        receiver_id: receiverId,
        product_id: productId,
        contact_type: contactType,
        success,
        error_message: error?.message || null,
        created_at: new Date().toISOString()
      }]);
  }
  
  static async trackProductView(productId, userId) {
    if (!productId) return;
    
    // Increment product views
    await supabase
      .from('products')
      .update({ 
        views: await this.incrementProductViews(productId)
      })
      .eq('id', productId);
    
    // Track activity
    if (userId) {
      await this.trackActivity(userId, 'view_product', {
        targetId: productId,
        targetType: 'product'
      });
    }
  }
  
  static async incrementProductViews(productId) {
    const { data } = await supabase
      .from('products')
      .select('views')
      .eq('id', productId)
      .single();
    
    return (data?.views || 0) + 1;
  }
}