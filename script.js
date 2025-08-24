// MrPromp - JavaScript functionality
class MrPromp {
    constructor() {
        this.apiKey = 'AIzaSyAKkVmXfllDciX7Xxc_X5hPOBuaW-szTik';
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
        this.history = this.loadHistory();
        this.currentTheme = localStorage.getItem('theme') || 'light';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.applyTheme();
        this.updateHistoryDisplay();
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Main improve button
        document.getElementById('improveBtn').addEventListener('click', () => {
            this.improvePrompt();
        });

        // History button
        document.getElementById('historyBtn').addEventListener('click', () => {
            this.toggleHistory();
        });

        // Close history button
        document.getElementById('closeHistoryBtn').addEventListener('click', () => {
            this.hideHistory();
        });

        // Results section buttons
        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copyImprovedPrompt();
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveCurrentPrompt();
        });

        document.getElementById('newPromptBtn').addEventListener('click', () => {
            this.resetForm();
        });

        // Auto-resize textarea
        const textarea = document.getElementById('originalPrompt');
        textarea.addEventListener('input', () => {
            this.autoResizeTextarea(textarea);
        });

        // Enter key to submit (Shift+Enter for new line)
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.improvePrompt();
            }
        });

        // Close history when clicking outside
        document.getElementById('historyPanel').addEventListener('click', (e) => {
            if (e.target.id === 'historyPanel') {
                this.hideHistory();
            }
        });
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.currentTheme);
        this.applyTheme();
    }

    applyTheme() {
        const html = document.documentElement;
        const body = document.body;
        const themeIcon = document.querySelector('#themeToggle i');
        
        if (this.currentTheme === 'dark') {
            html.classList.add('dark');
            body.className = 'min-h-screen overflow-x-hidden transition-all duration-500 bg-dark-bg text-white';
            themeIcon.className = 'fas fa-sun text-yellow-400 text-sm';
        } else {
            html.classList.remove('dark');
            body.className = 'min-h-screen overflow-x-hidden transition-all duration-500 bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900';
            themeIcon.className = 'fas fa-moon text-gray-700 text-sm';
        }
        
        this.showToast(`Tema ${this.currentTheme === 'dark' ? 'oscuro' : 'claro'} activado`, 'info');
    }

    async improvePrompt() {
        const originalPrompt = document.getElementById('originalPrompt').value.trim();
        
        if (!originalPrompt) {
            this.showToast('Por favor, escribe un prompt para mejorar', 'warning');
            return;
        }

        this.showLoading(true);
        this.disableButton(true);

        try {
            // First, check if we need additional information
            const needsForm = await this.checkIfNeedsAdditionalInfo(originalPrompt);
            
            if (needsForm && !this.hasFormData()) {
                this.showDynamicForm(needsForm);
                this.showLoading(false);
                this.disableButton(false);
                return;
            }

            // Get form data if available
            const additionalData = this.getFormData();
            
            // Improve the prompt
            const improvedPrompt = await this.callGeminiAPI(originalPrompt, additionalData);
            
            this.displayResults(originalPrompt, improvedPrompt);
            this.showLoading(false);
            this.disableButton(false);
            
        } catch (error) {
            console.error('Error improving prompt:', error);
            this.showToast('Error al mejorar el prompt. Inténtalo de nuevo.', 'error');
            this.showLoading(false);
            this.disableButton(false);
        }
    }

    async checkIfNeedsAdditionalInfo(prompt) {
        const checkPrompt = `
        Analiza el siguiente prompt y determina si necesitas información adicional del usuario para mejorarlo significativamente.

        Prompt: "${prompt}"

        Si necesitas información adicional, responde EXACTAMENTE en este formato JSON:
        {
            "needsInfo": true,
            "fields": [
                {
                    "name": "campo1",
                    "label": "Etiqueta del campo",
                    "type": "text|textarea|select",
                    "placeholder": "Texto de ayuda",
                    "options": ["opcion1", "opcion2"] // solo para select
                }
            ]
        }

        Si NO necesitas información adicional, responde EXACTAMENTE:
        {
            "needsInfo": false
        }

        Ejemplos de cuándo SÍ necesitas información:
        - Prompts muy genéricos que podrían beneficiarse de contexto específico
        - Solicitudes de contenido que requieren audiencia, tono, o formato específico
        - Prompts técnicos que necesitan nivel de experiencia o tecnologías específicas

        Ejemplos de cuándo NO necesitas información:
        - Prompts ya específicos y bien definidos
        - Solicitudes simples y claras
        `;

        try {
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: checkPrompt
                        }]
                    }]
                })
            });

            const data = await response.json();
            const result = data.candidates[0].content.parts[0].text.trim();
            
            try {
                const parsed = JSON.parse(result);
                return parsed.needsInfo ? parsed : null;
            } catch (e) {
                return null;
            }
        } catch (error) {
            console.error('Error checking for additional info:', error);
            return null;
        }
    }

    showDynamicForm(formConfig) {
        const formContainer = document.getElementById('dynamicForm');
        const fieldsContainer = document.getElementById('formFields');
        
        fieldsContainer.innerHTML = '';
        
        formConfig.fields.forEach(field => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'form-field';
            
            let fieldHTML = `<label class="form-label" for="${field.name}">${field.label}</label>`;
            
            switch (field.type) {
                case 'textarea':
                    fieldHTML += `<textarea id="${field.name}" name="${field.name}" class="form-input" rows="3" placeholder="${field.placeholder || ''}"></textarea>`;
                    break;
                case 'select':
                    fieldHTML += `<select id="${field.name}" name="${field.name}" class="form-input">
                        <option value="">Selecciona una opción</option>
                        ${field.options.map(option => `<option value="${option}">${option}</option>`).join('')}
                    </select>`;
                    break;
                default:
                    fieldHTML += `<input type="text" id="${field.name}" name="${field.name}" class="form-input" placeholder="${field.placeholder || ''}">`;
            }
            
            fieldDiv.innerHTML = fieldHTML;
            fieldsContainer.appendChild(fieldDiv);
        });
        
        formContainer.classList.remove('hidden');
        formContainer.classList.add('fade-in');
    }

    hasFormData() {
        const formFields = document.querySelectorAll('#formFields input, #formFields textarea, #formFields select');
        return Array.from(formFields).some(field => field.value.trim() !== '');
    }

    getFormData() {
        const formFields = document.querySelectorAll('#formFields input, #formFields textarea, #formFields select');
        const data = {};
        
        formFields.forEach(field => {
            if (field.value.trim()) {
                data[field.name] = field.value.trim();
            }
        });
        
        return data;
    }

    async callGeminiAPI(originalPrompt, additionalData = {}) {
        let improvePrompt = `
        Eres un experto en optimización de prompts para IA. Tu tarea es mejorar el siguiente prompt para que sea más efectivo, claro y específico.

        Prompt original: "${originalPrompt}"
        `;

        if (Object.keys(additionalData).length > 0) {
            improvePrompt += `\n\nInformación adicional proporcionada por el usuario:\n`;
            Object.entries(additionalData).forEach(([key, value]) => {
                improvePrompt += `- ${key}: ${value}\n`;
            });
        }

        improvePrompt += `
        
        Instrucciones para la mejora:
        1. Haz el prompt más específico y detallado
        2. Añade contexto relevante cuando sea necesario
        3. Incluye instrucciones claras sobre el formato de respuesta deseado
        4. Mejora la estructura y claridad
        5. Mantén la intención original pero hazlo más efectivo
        
        Responde ÚNICAMENTE con el prompt mejorado, sin explicaciones adicionales.
        `;

        const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: improvePrompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    }

    displayResults(original, improved) {
        document.getElementById('originalDisplay').textContent = original;
        document.getElementById('improvedDisplay').textContent = improved;
        
        const resultsSection = document.getElementById('resultsSection');
        resultsSection.classList.remove('hidden');
        resultsSection.classList.add('fade-in');
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    copyImprovedPrompt() {
        const improvedText = document.getElementById('improvedDisplay').textContent;
        
        navigator.clipboard.writeText(improvedText).then(() => {
            this.showToast('Prompt mejorado copiado al portapapeles', 'success');
        }).catch(() => {
            this.showToast('Error al copiar al portapapeles', 'error');
        });
    }

    saveCurrentPrompt() {
        const original = document.getElementById('originalDisplay').textContent;
        const improved = document.getElementById('improvedDisplay').textContent;
        
        if (!original || !improved) {
            this.showToast('No hay prompt para guardar', 'warning');
            return;
        }

        const promptData = {
            id: Date.now(),
            original,
            improved,
            timestamp: new Date().toISOString(),
            additionalData: this.getFormData()
        };

        this.history.unshift(promptData);
        this.saveHistory();
        this.updateHistoryDisplay();
        
        this.showToast('Prompt guardado en el historial', 'success');
    }

    resetForm() {
        document.getElementById('originalPrompt').value = '';
        document.getElementById('dynamicForm').classList.add('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
        
        // Reset textarea height
        const textarea = document.getElementById('originalPrompt');
        textarea.style.height = 'auto';
        
        // Focus on input
        textarea.focus();
    }

    toggleHistory() {
        const historyPanel = document.getElementById('historyPanel');
        
        if (historyPanel.classList.contains('hidden')) {
            this.showHistory();
        } else {
            this.hideHistory();
        }
    }

    showHistory() {
        const historyPanel = document.getElementById('historyPanel');
        historyPanel.classList.remove('hidden');
        historyPanel.classList.add('slide-in');
        
        this.updateHistoryDisplay();
    }

    hideHistory() {
        const historyPanel = document.getElementById('historyPanel');
        historyPanel.classList.add('slide-out');
        
        setTimeout(() => {
            historyPanel.classList.add('hidden');
            historyPanel.classList.remove('slide-out', 'slide-in');
        }, 300);
    }

    updateHistoryDisplay() {
        const historyList = document.getElementById('historyList');
        const emptyHistory = document.getElementById('emptyHistory');
        
        if (this.history.length === 0) {
            historyList.classList.add('hidden');
            emptyHistory.classList.remove('hidden');
            return;
        }
        
        historyList.classList.remove('hidden');
        emptyHistory.classList.add('hidden');
        
        historyList.innerHTML = this.history.map(item => `
            <div class="history-item bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 cursor-pointer" data-id="${item.id}">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        ${new Date(item.timestamp).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                    <div class="flex space-x-3">
                        <button class="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 text-sm font-medium transition-colors duration-200" onclick="mrPromp.useHistoryItem(${item.id})">
                            <i class="fas fa-redo mr-1"></i>Usar
                        </button>
                        <button class="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm font-medium transition-colors duration-200" onclick="mrPromp.deleteHistoryItem(${item.id})">
                            <i class="fas fa-trash mr-1"></i>Eliminar
                        </button>
                    </div>
                </div>
                <div class="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
                    <div class="flex items-center mb-2">
                        <div class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full mr-2"></div>
                        <span class="font-medium text-gray-600 dark:text-gray-400">Original:</span>
                    </div>
                    <p class="ml-4 text-gray-800 dark:text-gray-300">${item.original.substring(0, 150)}${item.original.length > 150 ? '...' : ''}</p>
                </div>
                <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    <div class="flex items-center mb-2">
                        <div class="w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full mr-2"></div>
                        <span class="font-medium text-transparent bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text">Mejorado:</span>
                    </div>
                    <p class="ml-4 text-gray-900 dark:text-white">${item.improved.substring(0, 150)}${item.improved.length > 150 ? '...' : ''}</p>
                </div>
            </div>
        `).join('');
    }

    useHistoryItem(id) {
        const item = this.history.find(h => h.id === id);
        if (!item) return;
        
        document.getElementById('originalPrompt').value = item.original;
        this.displayResults(item.original, item.improved);
        this.hideHistory();
        
        this.showToast('Prompt cargado desde el historial', 'info');
    }

    deleteHistoryItem(id) {
        this.history = this.history.filter(h => h.id !== id);
        this.saveHistory();
        this.updateHistoryDisplay();
        
        this.showToast('Prompt eliminado del historial', 'info');
    }

    loadHistory() {
        try {
            return JSON.parse(localStorage.getItem('mrpromp_history') || '[]');
        } catch {
            return [];
        }
    }

    saveHistory() {
        // Keep only last 50 items
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }
        localStorage.setItem('mrpromp_history', JSON.stringify(this.history));
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
            overlay.classList.add('fade-in');
        } else {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('fade-in', 'fade-out');
            }, 300);
        }
    }

    disableButton(disable) {
        const btn = document.getElementById('improveBtn');
        const btnText = document.getElementById('btnText');
        
        btn.disabled = disable;
        
        if (disable) {
            btnText.innerHTML = 'Procesando...';
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btnText.innerHTML = 'Preguntar';
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        toast.className = `toast toast-${type} scale-in`;
        toast.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${this.getToastIcon(type)} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize the application
const mrPromp = new MrPromp();

// Global functions for history actions
window.mrPromp = mrPromp;