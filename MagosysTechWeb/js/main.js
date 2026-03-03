// main.js - Modo estricto para mejor seguridad
'use strict';

// IIFE para evitar contaminación del ámbito global
(function() {
    // DOM Ready
    document.addEventListener('DOMContentLoaded', function() {
        initMobileMenu();
        initSmoothScroll();
        initSecurityHeaders();
    });

    // Menú hamburguesa
    function initMobileMenu() {
        const menuToggle = document.querySelector('.menu-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        if (menuToggle && navLinks) {
            menuToggle.addEventListener('click', function() {
                const expanded = this.getAttribute('aria-expanded') === 'true' ? false : true;
                this.setAttribute('aria-expanded', expanded);
                navLinks.classList.toggle('active');
            });
        }
    }

    // Smooth scroll
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const target = document.querySelector(targetId);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // Verificar headers de seguridad (solo para desarrollo)
    function initSecurityHeaders() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('🔒 Modo desarrollo - verificando seguridad...');
            // Aquí puedes agregar verificaciones locales
        }
    }

    // Prevenir clickjacking (medida extra de seguridad)
    if (self === top) {
        // La página no está en un iframe - todo bien
    } else {
        // La página está en un iframe - redirigir
        top.location = self.location;
    }
})();

// Exportar para pruebas (si es necesario)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initMobileMenu, initSmoothScroll };
}