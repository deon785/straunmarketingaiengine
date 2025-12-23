import DOMPurify from 'dompurify';
import React, { useEffect, useRef } from 'react';

const SafeHTML = ({ htmlContent, className = '', allowLinks = true, allowImages = true }) => {
    const containerRef = useRef(null);
    
    // ✅ CORRECT: useEffect INSIDE component
    useEffect(() => {
        if (!containerRef.current || !htmlContent) return;
        
        const timer = setTimeout(() => {
            const images = containerRef.current.querySelectorAll('img');
            
            images.forEach(img => {
                // Add lazy loading for product images
                if (!img.loading) img.loading = 'lazy';
                if (!img.decoding) img.decoding = 'async';
            });
        }, 0); // Immediate after render
        
        return () => clearTimeout(timer);
    }, [htmlContent]); // Critical: re-run when description changes
    
    // ✅ FIXED: Use allowLinks and allowImages in config
    const allowedTags = [
        'b', 'strong', 'i', 'em', 'u', 's', 'strike',
        'p', 'br', 'div', 'span', 'blockquote',
        'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ];
    
    const allowedAttrs = ['class', 'id', 'title', 'style'];
    
    // Conditionally add tags based on props
    if (allowLinks) {
        allowedTags.push('a');
        allowedAttrs.push('href', 'target', 'rel');
    }
    
    if (allowImages) {
        allowedTags.push('img');
        allowedAttrs.push('src', 'alt', 'width', 'height');
    }
    
    const sanitizedContent = DOMPurify.sanitize(htmlContent || '', {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: allowedAttrs,
        
        // SECURITY: Critical safety settings
        FORBID_ATTR: [
            'onclick', 'onload', 'onerror', 'onmouseover',
            'onmouseout', 'onkeydown', 'onkeyup'
        ],
        
        // SECURITY: Allow only these image sources
        ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp):\/\/|\/|data:image\/)/i,
        
        // SECURITY: Post-processing
        AFTER_SANITIZE_ATTRIBUTES: function(node) {
            // Force safe image attributes
            if (node.tagName === 'IMG' && allowImages) {
                // Note: loading attribute already added in useEffect
                // But we add it here too for initial sanitization
                node.setAttribute('loading', 'lazy');
                
                // Limit image dimensions
                const currentStyle = node.getAttribute('style') || '';
                if (!currentStyle.includes('max-width')) {
                    node.setAttribute('style', 
                        currentStyle + '; max-width: 100%; height: auto;'
                    );
                }
                
                // Block dangerous data URLs
                const src = node.getAttribute('src') || '';
                if (src.startsWith('data:') && !src.startsWith('data:image/')) {
                    node.setAttribute('src', '');
                    node.setAttribute('alt', 'Invalid image');
                }
            }
            
            // Make external links open in new tab safely
            if (node.tagName === 'A' && allowLinks && node.hasAttribute('href')) {
                const href = node.getAttribute('href');
                if (href && href.startsWith('http')) {
                    node.setAttribute('target', '_blank');
                    node.setAttribute('rel', 'noopener noreferrer');
                }
            }
        }
    });
        
    return (
        <div 
            ref={containerRef}
            className={`safe-html-content ${className}`.trim()}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }} 
        />
    );
};

SafeHTML.defaultProps = {
    htmlContent: '',
    className: '',
    allowLinks: true,
    allowImages: true
};

export default SafeHTML;