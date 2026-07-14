// src/hooks/useBouncer.js
// 🚪 BOUNCER - His only job is to stop re-renders
// He doesn't care about validation, errors, or form logic
// He just makes sure NO re-renders happen while typing

import { useRef, useCallback } from 'react';

export const useBouncer = (initialValues = {}) => {
  // ✅ All values stored in refs - NO re-renders
  const fieldRefs = useRef({});
  
  // Initialize refs for each field
  Object.keys(initialValues).forEach(key => {
    if (!fieldRefs.current[key]) {
      fieldRefs.current[key] = { current: null };
    }
  });

  // Register a field - returns props for the input
  const register = useCallback((fieldName) => {
    const fieldRef = fieldRefs.current[fieldName];
    
    return {
      ref: (element) => {
        fieldRef.current = element;
        // Set initial value if provided
        if (element && initialValues[fieldName] !== undefined) {
          if (element.type === 'checkbox') {
            element.checked = initialValues[fieldName];
          } else {
            element.value = initialValues[fieldName];
          }
        }
      },
      name: fieldName,
      id: fieldName,
      defaultValue: initialValues[fieldName] || '',
    };
  }, [initialValues]);

  // Get all current values - called ONLY on submit
  const getValues = useCallback(() => {
    const result = {};
    Object.keys(fieldRefs.current).forEach(key => {
      const ref = fieldRefs.current[key];
      if (ref && ref.current) {
        if (ref.current.type === 'checkbox') {
          result[key] = ref.current.checked;
        } else {
          result[key] = ref.current.value || '';
        }
      } else {
        result[key] = initialValues[key] || '';
      }
    });
    return result;
  }, [initialValues]);

  // Get a specific field value
  const getValue = useCallback((fieldName) => {
    const ref = fieldRefs.current[fieldName];
    if (ref && ref.current) {
      if (ref.current.type === 'checkbox') {
        return ref.current.checked;
      }
      return ref.current.value || '';
    }
    return initialValues[fieldName] || '';
  }, [initialValues]);

  // Set a specific field value (for reset)
  const setValue = useCallback((fieldName, value) => {
    const ref = fieldRefs.current[fieldName];
    if (ref && ref.current) {
      if (ref.current.type === 'checkbox') {
        ref.current.checked = value;
      } else {
        ref.current.value = value;
      }
    }
  }, []);

  // Reset ALL fields to initial values
  const reset = useCallback(() => {
    Object.keys(fieldRefs.current).forEach(key => {
      const ref = fieldRefs.current[key];
      if (ref && ref.current) {
        if (ref.current.type === 'checkbox') {
          ref.current.checked = initialValues[key] || false;
        } else {
          ref.current.value = initialValues[key] || '';
        }
      }
    });
  }, [initialValues]);

  // Clear all fields (set to empty)
  const clear = useCallback(() => {
    Object.keys(fieldRefs.current).forEach(key => {
      const ref = fieldRefs.current[key];
      if (ref && ref.current) {
        if (ref.current.type === 'checkbox') {
          ref.current.checked = false;
        } else {
          ref.current.value = '';
        }
      }
    });
  }, []);

  // 🚪 BOUNCER'S ONLY JOB - Stop re-renders
  // Return only the essentials
  return {
    // Registration - attaches refs to inputs
    register,
    
    // Value getters - ONLY used on submit
    getValues,
    getValue,
    
    // Value setters - for reset/clear
    setValue,
    reset,
    clear,
    
    // For debugging
    _refs: fieldRefs,
  };
};

export default useBouncer;