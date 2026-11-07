// src/hooks/useBouncer.js
import { useRef, useMemo } from 'react';

console.log('🔥🔥🔥 LOADING THE NEW USEBOUNCER FILE 🔥🔥🔥');

export const useBouncer = (initialValues = {}) => {
  // ✅ 1. Use useRef to persist the fieldRefs across renders
  const fieldRefs = useRef({});
  
  // Initialize refs for each field ONLY if they don't exist yet
  Object.keys(initialValues).forEach(key => {
    if (!fieldRefs.current[key]) {
      fieldRefs.current[key] = { current: null };
    }
  });

  // ✅ 2. Wrap the entire return value in useMemo. 
  // We only depend on the initial values (which should be passed as a stable object from the parent).
  return useMemo(() => {
    const register = (fieldName) => {
      const fieldRef = fieldRefs.current[fieldName];
      
      return {
        ref: (element) => {
          if (fieldRef) fieldRef.current = element;
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
    };

    const getValues = () => {
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
    };

    const getValue = (fieldName) => {
      const ref = fieldRefs.current[fieldName];
      if (ref && ref.current) {
        if (ref.current.type === 'checkbox') {
          return ref.current.checked;
        }
        return ref.current.value || '';
      }
      return initialValues[fieldName] || '';
    };

    const setValue = (fieldName, value) => {
      const ref = fieldRefs.current[fieldName];
      if (ref && ref.current) {
        if (ref.current.type === 'checkbox') {
          ref.current.checked = value;
        } else {
          ref.current.value = value;
        }
      }
    };

    const reset = () => {
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
    };

    const clear = () => {
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
    };

    return {
      register,
      getValues,
      getValue,
      setValue,
      reset,
      clear,
      _refs: fieldRefs.current,
    };
  }, [initialValues]); // ⚠️ Warning: see note below about this dependency
};

export default useBouncer;