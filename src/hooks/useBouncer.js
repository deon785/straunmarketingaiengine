// src/hooks/useBouncer.js
// 🚪 BOUNCER - No hooks version (avoids React hook issues)
console.log('🔥🔥🔥 LOADING THE NEW USEBOUNCER FILE 🔥🔥🔥');

export const useBouncer = (initialValues = {}) => {
  // Use a simple object instead of useRef
  const fieldRefs = {};
  
  // Initialize refs for each field
  Object.keys(initialValues).forEach(key => {
    fieldRefs[key] = { current: null };
  });

  const register = (fieldName) => {
    const fieldRef = fieldRefs[fieldName];
    
    return {
      ref: (element) => {
        fieldRef.current = element;
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
    Object.keys(fieldRefs).forEach(key => {
      const ref = fieldRefs[key];
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
    const ref = fieldRefs[fieldName];
    if (ref && ref.current) {
      if (ref.current.type === 'checkbox') {
        return ref.current.checked;
      }
      return ref.current.value || '';
    }
    return initialValues[fieldName] || '';
  };

  const setValue = (fieldName, value) => {
    const ref = fieldRefs[fieldName];
    if (ref && ref.current) {
      if (ref.current.type === 'checkbox') {
        ref.current.checked = value;
      } else {
        ref.current.value = value;
      }
    }
  };

  const reset = () => {
    Object.keys(fieldRefs).forEach(key => {
      const ref = fieldRefs[key];
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
    Object.keys(fieldRefs).forEach(key => {
      const ref = fieldRefs[key];
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
    _refs: fieldRefs,
  };
};

export default useBouncer;