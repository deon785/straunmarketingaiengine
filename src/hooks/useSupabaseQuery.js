// hooks/useSupabaseQuery.js
import { useState, useCallback } from 'react'
import { queryWithRetry, sendPushNotification, callEdgeFunction } from '../lib/supabase'

export function useSupabaseQuery() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  
  const execute = useCallback(async (queryFn, options = {}) => {
    const { showToast = false, onSuccess, onError } = options
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await queryFn()
      
      if (result.error) {
        setError(result.error)
        if (onError) onError(result.error)
        return { success: false, error: result.error, data: null }
      }
      
      setData(result.data)
      if (onSuccess) onSuccess(result.data)
      return { success: true, data: result.data, error: null }
      
    } catch (err) {
      setError(err)
      if (onError) onError(err)
      return { success: false, error: err, data: null }
      
    } finally {
      setLoading(false)
    }
  }, [])
  
  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setData(null)
  }, [])
  
  return { execute, loading, error, data, reset }
}

// Specific query hooks for common operations
export function useFetchData(tableName) {
  const { execute, loading, error, data } = useSupabaseQuery()
  
  const fetchData = useCallback(async (filters = {}) => {
    let query = supabase.from(tableName).select('*')
    
    // Apply filters if any
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
    
    return await execute(() => query)
  }, [tableName, execute])
  
  return { fetchData, loading, error, data }
}

export function useInsertData(tableName) {
  const { execute, loading, error } = useSupabaseQuery()
  
  const insertData = useCallback(async (insertData) => {
    return await execute(() => supabase.from(tableName).insert(insertData))
  }, [tableName, execute])
  
  return { insertData, loading, error }
}

export function useUpdateData(tableName) {
  const { execute, loading, error } = useSupabaseQuery()
  
  const updateData = useCallback(async (updates, matchColumn, matchValue) => {
    return await execute(() => 
      supabase.from(tableName).update(updates).eq(matchColumn, matchValue)
    )
  }, [tableName, execute])
  
  return { updateData, loading, error }
}

export function useDeleteData(tableName) {
  const { execute, loading, error } = useSupabaseQuery()
  
  const deleteData = useCallback(async (matchColumn, matchValue) => {
    return await execute(() => 
      supabase.from(tableName).delete().eq(matchColumn, matchValue)
    )
  }, [tableName, execute])
  
  return { deleteData, loading, error }
}

export function usePushNotification() {
  const [sending, setSending] = useState(false)
  
  const sendNotification = useCallback(async (userId, notification) => {
    setSending(true)
    try {
      const result = await sendPushNotification(userId, notification)
      return result
    } finally {
      setSending(false)
    }
  }, [])
  
  return { sendNotification, sending }
}

export function useEdgeFunction() {
  const [calling, setCalling] = useState(false)
  
  const callFunction = useCallback(async (functionName, payload, options = {}) => {
    setCalling(true)
    try {
      const result = await callEdgeFunction(functionName, payload, options)
      return result
    } finally {
      setCalling(false)
    }
  }, [])
  
  return { callFunction, calling }
}