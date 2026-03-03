// ===== MENÚ HAMBURGUESA =====
const menuToggle = document.querySelector('.menu-toggle');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-list a');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        const icon = menuToggle.querySelector('i');
        if (navMenu.classList.contains('active')) {
            icon.className = 'fas fa-times';
        } else {
            icon.className = 'fas fa-bars';
        }
    });
}

// Cerrar menú al hacer clic en un enlace
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        const icon = menuToggle.querySelector('i');
        icon.className = 'fas fa-bars';
    });
});

// ===== MODO OSCURO =====
const themeSwitch = document.querySelector('.theme-switch');
const currentTheme = localStorage.getItem('theme');

// Verificar preferencia del sistema
if (!currentTheme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon('dark');
    }
} else {
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);
}

if (themeSwitch) {
    themeSwitch.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = theme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = themeSwitch?.querySelector('i');
    if (icon) {
        if (theme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
}

// ===== ANIMACIONES DE SCROLL =====
function reveal() {
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    
    reveals.forEach(element => {
        const windowHeight = window.innerHeight;
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150;
        
        if (elementTop < windowHeight - elementVisible) {
            element.classList.add('active');
        }
    });
}

window.addEventListener('scroll', reveal);
reveal(); // Ejecutar al cargar

// ===== FILTRO DE PORTAFOLIO =====
const filterBtns = document.querySelectorAll('.filter-btn');
const portafolioItems = document.querySelectorAll('.portafolio-item');

if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover active de todos
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            
            portafolioItems.forEach(item => {
                if (filter === 'all' || item.dataset.category === filter) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// ===== SMOOTH SCROLL PARA ENLACES =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===== FORMULARIO DE CONTACTO =====
document.getElementById('contactForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const messageDiv = document.getElementById('formMessage');
    
    // Validación básica
    const nombre = formData.get('nombre');
    const email = formData.get('email');
    const mensaje = formData.get('mensaje');
    
    if (!nombre || !email || !mensaje) {
        messageDiv.className = 'form-message error';
        messageDiv.textContent = 'Por favor, completa todos los campos requeridos.';
        return;
    }
    
    if (!isValidEmail(email)) {
        messageDiv.className = 'form-message error';
        messageDiv.textContent = 'Por favor, ingresa un email válido.';
        return;
    }
    
    // Deshabilitar botón mientras se envía
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    
    try {
        // Simulación de envío (reemplazar con tu endpoint real)
        // Para pruebas, puedes usar: https://formspree.io/f/tu-id-unico
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        messageDiv.className = 'form-message success';
        messageDiv.textContent = '¡Mensaje enviado con éxito! Te contactaremos pronto.';
        form.reset();
        
        // También puedes enviar por WhatsApp como respaldo
        sendToWhatsApp(formData);
        
    } catch (error) {
        messageDiv.className = 'form-message error';
        messageDiv.textContent = 'Hubo un error. Te redirigiremos a WhatsApp.';
        
        // Respaldo: enviar por WhatsApp
        sendToWhatsApp(formData);
        
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        
        // Ocultar mensaje después de 5 segundos
        setTimeout(() => {
            messageDiv.style.display = 'none';
            messageDiv.className = 'form-message';
        }, 5000);
    }
});

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function sendToWhatsApp(formData) {
    const nombre = formData.get('nombre');
    const email = formData.get('email');
    const telefono = formData.get('telefono');
    const servicio = formData.get('servicio');
    const mensaje = formData.get('mensaje');
    
    const texto = `*Nuevo mensaje desde la web MagosysTech*%0A%0A*Nombre:* ${nombre}%0A*Email:* ${email}%0A*Teléfono:* ${telefono || 'No especificado'}%0A*Servicio:* ${servicio || 'No especificado'}%0A*Mensaje:* ${mensaje}`;
    
    const whatsappUrl = `https://wa.me/584121234567?text=${texto}`;
    window.open(whatsappUrl, '_blank');
}

// ===== NEWSLETTER FORM =====
document.querySelector('.newsletter-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = this.querySelector('input[type="email"]').value;
    
    if (email && isValidEmail(email)) {
        alert('¡Gracias por suscribirte! Pronto recibirás nuestras novedades.');
        this.reset();
    } else {
        alert('Por favor, ingresa un email válido.');
    }
});

// ===== ACTIVE LINK EN MENÚ =====
function setActiveLink() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-list a');
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

window.addEventListener('scroll', setActiveLink);

// ===== INTERSECCIÓN OBSERVER PARA ANIMACIONES (fallback) =====
if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
        observer.observe(el);
    });
}

// ===== DETECTAR CONEXIÓN LENTA PARA IMÁGENES =====
if ('connection' in navigator) {
    if (navigator.connection.saveData || navigator.connection.effectiveType.includes('2g')) {
        // Cargar imágenes de baja calidad
        document.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.includes('low')) {
                img.setAttribute('data-src', src);
                img.setAttribute('src', src.replace('.jpg', '-low.jpg').replace('.png', '-low.png'));
            }
        });
    }
}