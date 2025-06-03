
class RouteOptimizer {
    constructor() {
        this.addresses = [];
        this.map = null;
        this.markers = [];
        this.routeLayer = null;
        this.video = null;
        this.isOptimized = false;
        this.userLocation = null;
        this.userMarker = null;
        this.userAddress = null;
        this.isNavigating = false;
        this.currentDestinationIndex = 0;
        this.watchId = null;
        
        this.initializeMap();
        this.bindEvents();
        this.requestGeolocation();
        this.setupAutofocus();
    }

    initializeMap() {
        // Inicializar mapa OpenStreetMap
        this.map = L.map('map').setView([-23.5505, -46.6333], 11); // São Paulo como padrão

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Adicionar controle de escala
        L.control.scale().addTo(this.map);
    }

    bindEvents() {
        // CEP
        document.getElementById('searchCepBtn').addEventListener('click', () => this.searchByCEP());
        document.getElementById('cepInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchByCEP();
        });

        // Endereço manual
        document.getElementById('addAddressBtn').addEventListener('click', () => this.addManualAddress());
        document.getElementById('addressInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) this.addManualAddress();
        });

        // Câmera OCR
        document.getElementById('startCameraBtn').addEventListener('click', () => this.startCamera());
        document.getElementById('captureBtn').addEventListener('click', () => this.captureAndOCR());

        // Controles de rota
        document.getElementById('optimizeBtn').addEventListener('click', () => this.optimizeRoute());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('openMapsBtn').addEventListener('click', () => this.openInMaps());

        // Controles do mapa
        document.getElementById('centerMapBtn').addEventListener('click', () => this.centerMap());
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());

        // Formatação automática de CEP
        document.getElementById('cepInput').addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 5) {
                value = value.substring(0, 5) + '-' + value.substring(5, 8);
            }
            e.target.value = value;
        });
    }

    requestGeolocation() {
        if (navigator.geolocation) {
            // Obter localização com alta precisão
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    this.userLocation = { lat, lng };
                    this.map.setView([lat, lng], 15);
                    
                    // Adicionar marcador da localização atual
                    this.userMarker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'user-location-marker',
                            html: '<i class="fas fa-user-circle"></i>',
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        })
                    }).addTo(this.map)
                    .bindPopup('Sua localização atual');

                    // Obter endereço da localização atual
                    try {
                        const address = await this.reverseGeocode(lat, lng);
                        this.userAddress = address;
                        this.userMarker.setPopupContent(`<strong>Sua localização:</strong><br>${address}`);
                    } catch (error) {
                        console.log('Erro ao obter endereço da localização:', error);
                    }
                },
                (error) => {
                    console.log('Geolocalização não disponível:', error);
                    // Tentar localização aproximada por IP
                    this.getLocationByIP();
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutos
                }
            );

            // Observar mudanças na localização
            if (navigator.geolocation.watchPosition) {
                this.watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        if (this.isNavigating) {
                            this.updateUserLocation(position.coords.latitude, position.coords.longitude);
                        }
                    },
                    null,
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
                );
            }
        }
    }

    async searchByCEP() {
        const cep = document.getElementById('cepInput').value.replace(/\D/g, '');
        
        if (cep.length !== 8) {
            alert('Por favor, digite um CEP válido (8 dígitos)');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) {
                throw new Error('CEP não encontrado');
            }

            const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
            document.getElementById('addressInput').value = fullAddress;
            
            // Geocodificar o endereço
            await this.geocodeAndAdd(fullAddress);
            document.getElementById('cepInput').value = '';
            
        } catch (error) {
            alert('Erro ao buscar CEP: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async addManualAddress() {
        const address = document.getElementById('addressInput').value.trim();
        
        if (!address) {
            alert('Por favor, digite um endereço');
            return;
        }

        await this.geocodeAndAdd(address);
        document.getElementById('addressInput').value = '';
    }

    async geocodeAndAdd(address) {
        this.showLoading(true);

        try {
            // Usar Nominatim (OpenStreetMap) para geocodificação gratuita
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=BR`
            );
            
            const data = await response.json();

            if (data.length === 0) {
                throw new Error('Endereço não encontrado');
            }

            const location = data[0];
            const lat = parseFloat(location.lat);
            const lng = parseFloat(location.lon);

            this.addAddress({
                address: location.display_name,
                lat: lat,
                lng: lng,
                originalAddress: address
            });

        } catch (error) {
            alert('Erro ao localizar endereço: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    addAddress(addressData) {
        this.addresses.push({
            ...addressData,
            id: Date.now(),
            order: this.addresses.length + 1
        });

        this.isOptimized = false;
        this.updateAddressList();
        this.updateMap();
        this.updateStats();
    }

    async startCamera() {
        try {
            const video = document.getElementById('video');
            const startBtn = document.getElementById('startCameraBtn');
            const captureBtn = document.getElementById('captureBtn');

            // Configurações otimizadas para captura de documentos/endereços
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    focusMode: 'single-shot'
                } 
            });
            
            video.srcObject = stream;
            video.style.display = 'block';
            video.play();

            startBtn.style.display = 'none';
            captureBtn.style.display = 'inline-flex';

            this.video = video;

            // Adicionar dica visual
            document.getElementById('ocrResult').innerHTML = '<i class="fas fa-info-circle"></i> <strong>Dica:</strong> Posicione a câmera sobre um CEP ou endereço. O sistema detectará automaticamente.';

        } catch (error) {
            alert('Erro ao acessar câmera: ' + error.message);
        }
    }

    async captureAndOCR() {
        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const ocrResult = document.getElementById('ocrResult');

        // Capturar frame do vídeo
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        this.showLoading(true);
        ocrResult.textContent = 'Processando imagem...';

        try {
            // Usar Tesseract.js para OCR com configurações otimizadas para números
            const { data: { text } } = await Tesseract.recognize(canvas, 'por', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        ocrResult.textContent = `Processando: ${Math.round(m.progress * 100)}%`;
                    }
                }
            });
            
            // Processar texto para extrair CEP ou endereço
            const extractedData = this.extractAddressFromText(text);
            
            if (extractedData) {
                if (extractedData.type === 'cep') {
                    // CEP detectado - buscar automaticamente
                    ocrResult.innerHTML = `<strong>CEP detectado:</strong> ${extractedData.value}<br>Buscando endereço...`;
                    document.getElementById('cepInput').value = extractedData.value;
                    
                    // Aguardar um pouco para mostrar o CEP detectado
                    setTimeout(async () => {
                        await this.searchByCEPValue(extractedData.value);
                    }, 1000);
                    
                } else if (extractedData.type === 'address') {
                    // Endereço detectado
                    ocrResult.innerHTML = `<strong>Endereço detectado:</strong> ${extractedData.value}`;
                    document.getElementById('addressInput').value = extractedData.value;
                    
                    // Tentar geocodificar automaticamente
                    if (this.looksLikeAddress(extractedData.value)) {
                        setTimeout(async () => {
                            await this.geocodeAndAdd(extractedData.value);
                        }, 1000);
                    }
                }
            } else {
                // Tentar extrair qualquer texto útil
                const cleanText = text.replace(/[^\w\s,.-]/g, ' ').replace(/\s+/g, ' ').trim();
                if (cleanText.length > 5) {
                    ocrResult.innerHTML = `<strong>Texto detectado:</strong> ${cleanText}<br><small>Nenhum CEP ou endereço identificado automaticamente</small>`;
                    document.getElementById('addressInput').value = cleanText;
                } else {
                    ocrResult.textContent = 'Nenhum texto legível detectado na imagem';
                }
            }

        } catch (error) {
            ocrResult.textContent = 'Erro ao processar imagem: ' + error.message;
        } finally {
            this.showLoading(false);
            this.stopCamera();
        }
    }

    async searchByCEPValue(cep) {
        const cleanCEP = cep.replace(/\D/g, '');
        
        if (cleanCEP.length !== 8) {
            document.getElementById('ocrResult').innerHTML += '<br><span style="color: red;">CEP inválido</span>';
            return;
        }

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
            const data = await response.json();

            if (data.erro) {
                throw new Error('CEP não encontrado');
            }

            const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
            document.getElementById('addressInput').value = fullAddress;
            document.getElementById('ocrResult').innerHTML += `<br><strong>Endereço encontrado:</strong> ${fullAddress}`;
            
            // Geocodificar e adicionar automaticamente
            await this.geocodeAndAdd(fullAddress);
            document.getElementById('cepInput').value = '';
            
        } catch (error) {
            document.getElementById('ocrResult').innerHTML += `<br><span style="color: red;">Erro: ${error.message}</span>`;
        }
    }

    extractAddressFromText(text) {
        // Limpar e processar texto
        const cleanText = text.replace(/[^\w\s,.-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Primeiro, buscar por CEP no texto
        const cepFound = this.extractCEPFromText(text);
        if (cepFound) {
            return { type: 'cep', value: cepFound };
        }

        // Padrões mais específicos para endereços brasileiros
        const patterns = [
            // Padrões com tipo de logradouro + nome + número
            /((?:Rua|Avenida|Av|Alameda|Travessa|Praça|Estrada|Rod|Rodovia)\s+[^,\n]+),?\s*(?:n[ºº°]?\.?\s*)?(\d+)/gi,
            // Apenas nome + número
            /([A-Za-z\s]{3,}),?\s*(?:n[ºº°]?\.?\s*)?(\d+)/g,
            // Padrão geral com vírgulas
            /([^,\n]{10,}),\s*([^,\n]{5,})/g
        ];

        let bestMatch = null;
        let bestScore = 0;

        for (const pattern of patterns) {
            const matches = [...text.matchAll(pattern)];
            for (const match of matches) {
                const candidate = match[0].trim();
                const score = this.scoreAddressCandidate(candidate);
                
                if (score > bestScore && candidate.length > 8) {
                    bestMatch = candidate;
                    bestScore = score;
                }
            }
        }

        // Se não encontrar padrão específico, usar texto limpo se parecer endereço
        if (!bestMatch && cleanText.length > 15 && this.looksLikeAddress(cleanText)) {
            bestMatch = cleanText;
        }

        return bestMatch ? { type: 'address', value: bestMatch } : null;
    }

    extractCEPFromText(text) {
        // Padrões avançados para detectar CEP
        const cepPatterns = [
            // CEP com hífen
            /\b(\d{5}[-]\d{3})\b/g,
            // CEP com espaço
            /\b(\d{5}[\s]\d{3})\b/g,
            // CEP sem separador
            /\b(\d{8})\b/g,
            // CEP com pontos
            /\b(\d{5}[.]\d{3})\b/g,
            // CEP fragmentado por OCR
            /\b(\d{2}[\s.,-]?\d{3}[\s.,-]?\d{3})\b/g
        ];

        const allMatches = [];
        
        for (const pattern of cepPatterns) {
            const matches = [...text.matchAll(pattern)];
            for (const match of matches) {
                let candidate = match[1].replace(/[^\d]/g, '');
                
                // Validar se tem 8 dígitos
                if (candidate.length === 8) {
                    // Validação básica de CEP brasileiro
                    if (this.isValidBrazilianCEP(candidate)) {
                        allMatches.push({
                            cep: candidate,
                            score: this.scoreCEPCandidate(candidate, match[0])
                        });
                    }
                }
            }
        }

        // Retornar o CEP com maior score
        if (allMatches.length > 0) {
            allMatches.sort((a, b) => b.score - a.score);
            const bestCEP = allMatches[0].cep;
            return bestCEP.substring(0, 5) + '-' + bestCEP.substring(5);
        }

        return null;
    }

    isValidBrazilianCEP(cep) {
        // Verificações básicas para CEP brasileiro
        if (cep === '00000000' || cep === '99999999') return false;
        
        // Verificar se não é uma sequência repetitiva
        const firstDigit = cep[0];
        if (cep.split('').every(digit => digit === firstDigit)) return false;
        
        // Verificar faixas válidas (primeira região deve ser 0-9)
        const firstDigitNum = parseInt(firstDigit);
        if (firstDigitNum < 0 || firstDigitNum > 9) return false;
        
        return true;
    }

    scoreCEPCandidate(cep, originalText) {
        let score = 10; // Score base para CEP
        
        // Bonus se está formatado corretamente no texto original
        if (originalText.includes('-')) score += 3;
        
        // Bonus se está próximo de palavras relacionadas
        const context = originalText.toLowerCase();
        const contextKeywords = ['cep', 'código', 'postal', 'endereço'];
        contextKeywords.forEach(keyword => {
            if (context.includes(keyword)) score += 2;
        });
        
        // Penalty para CEPs muito simples (mas ainda válidos)
        if (cep.substring(0, 4) === '0000') score -= 2;
        
        return score;
    }

    scoreAddressCandidate(text) {
        let score = 0;
        const lowerText = text.toLowerCase();
        
        // Pontos positivos
        const positiveKeywords = ['rua', 'avenida', 'av', 'alameda', 'travessa', 'praça', 'estrada', 'rod', 'numero', 'nº', 'n°'];
        positiveKeywords.forEach(keyword => {
            if (lowerText.includes(keyword)) score += 2;
        });
        
        // Tem número
        if (/\d+/.test(text)) score += 3;
        
        // Tem vírgula (separadores comuns)
        if (text.includes(',')) score += 1;
        
        // Comprimento adequado
        if (text.length >= 15 && text.length <= 100) score += 1;
        
        // Pontos negativos
        const negativeKeywords = ['email', 'telefone', 'cpf', 'rg', 'data'];
        negativeKeywords.forEach(keyword => {
            if (lowerText.includes(keyword)) score -= 3;
        });
        
        return score;
    }

    looksLikeAddress(text) {
        const addressKeywords = ['rua', 'av', 'avenida', 'alameda', 'travessa', 'praça', 'número', 'num'];
        const lowerText = text.toLowerCase();
        return addressKeywords.some(keyword => lowerText.includes(keyword)) || /\d+/.test(text);
    }

    stopCamera() {
        const video = document.getElementById('video');
        const startBtn = document.getElementById('startCameraBtn');
        const captureBtn = document.getElementById('captureBtn');

        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }

        video.style.display = 'none';
        startBtn.style.display = 'inline-flex';
        captureBtn.style.display = 'none';
    }

    async optimizeRoute() {
        if (this.addresses.length < 2) {
            alert('Adicione pelo menos 2 endereços para otimizar a rota');
            return;
        }

        this.showLoading(true);

        try {
            // Algoritmo de otimização usando nearest neighbor heuristic
            const optimized = await this.nearestNeighborOptimization();
            
            // Atualizar ordem dos endereços
            this.addresses = optimized.map((addr, index) => ({
                ...addr,
                order: index + 1
            }));

            this.isOptimized = true;
            this.updateAddressList();
            this.updateMap();
            this.updateStats();

            document.getElementById('openMapsBtn').disabled = false;

        } catch (error) {
            alert('Erro ao otimizar rota: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async nearestNeighborOptimization() {
        const unvisited = [...this.addresses];
        const optimized = [];
        
        // Começar pelo primeiro endereço
        let current = unvisited.shift();
        optimized.push(current);

        while (unvisited.length > 0) {
            let nearest = null;
            let minDistance = Infinity;

            // Encontrar o mais próximo
            for (const address of unvisited) {
                const distance = this.calculateDistance(current, address);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = address;
                }
            }

            optimized.push(nearest);
            unvisited.splice(unvisited.indexOf(nearest), 1);
            current = nearest;
        }

        return optimized;
    }

    calculateDistance(addr1, addr2) {
        // Fórmula de Haversine para distância entre coordenadas
        const R = 6371; // Raio da Terra em km
        const dLat = this.toRad(addr2.lat - addr1.lat);
        const dLng = this.toRad(addr2.lng - addr1.lng);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRad(addr1.lat)) * Math.cos(this.toRad(addr2.lat)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    updateAddressList() {
        const list = document.getElementById('addressesList');
        list.innerHTML = '';

        this.addresses.forEach((address, index) => {
            const li = document.createElement('li');
            let className = `address-item ${this.isOptimized ? 'optimized' : ''}`;
            
            // Adicionar classes para navegação
            if (this.isNavigating) {
                if (index < this.currentDestinationIndex) {
                    className += ' completed';
                } else if (index === this.currentDestinationIndex) {
                    className += ' current';
                }
            }
            
            li.className = className;
            
            let statusIcon = '';
            if (this.isNavigating) {
                if (index < this.currentDestinationIndex) {
                    statusIcon = '<i class="fas fa-check-circle status-icon completed"></i>';
                } else if (index === this.currentDestinationIndex) {
                    statusIcon = '<i class="fas fa-navigation status-icon current"></i>';
                }
            }
            
            li.innerHTML = `
                <div class="address-order">${address.order}</div>
                <div class="address-text">${address.originalAddress || address.address}</div>
                ${statusIcon}
                <button class="remove-btn" onclick="routeOptimizer.removeAddress(${address.id})" ${this.isNavigating ? 'disabled' : ''}>
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            list.appendChild(li);
        });
    }

    removeAddress(id) {
        this.addresses = this.addresses.filter(addr => addr.id !== id);
        this.isOptimized = false;
        
        // Reordenar
        this.addresses.forEach((addr, index) => {
            addr.order = index + 1;
        });

        this.updateAddressList();
        this.updateMap();
        this.updateStats();

        if (this.addresses.length === 0) {
            document.getElementById('openMapsBtn').disabled = true;
        }
    }

    updateMap() {
        // Limpar marcadores existentes
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        if (this.addresses.length === 0) return;

        // Adicionar novos marcadores
        this.addresses.forEach((address, index) => {
            const marker = L.marker([address.lat, address.lng])
                .bindPopup(`
                    <div class="popup-address">${address.originalAddress || address.address}</div>
                    <div class="popup-order">Parada ${address.order}</div>
                `);
            
            marker.addTo(this.map);
            this.markers.push(marker);
        });

        // Adicionar linha da rota se otimizada
        if (this.isOptimized && this.addresses.length > 1) {
            const latlngs = this.addresses.map(addr => [addr.lat, addr.lng]);
            this.routeLayer = L.polyline(latlngs, {
                color: '#28a745',
                weight: 4,
                opacity: 0.8
            }).addTo(this.map);
        }

        // Ajustar visualização
        this.centerMap();
    }

    centerMap() {
        if (this.addresses.length === 0) return;

        if (this.addresses.length === 1) {
            this.map.setView([this.addresses[0].lat, this.addresses[0].lng], 15);
        } else {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    updateStats() {
        const totalPoints = this.addresses.length;
        let totalDistance = 0;
        let totalTime = 0;

        if (this.addresses.length > 1) {
            for (let i = 0; i < this.addresses.length - 1; i++) {
                totalDistance += this.calculateDistance(this.addresses[i], this.addresses[i + 1]);
            }
            
            // Estimar tempo (assumindo velocidade média de 30 km/h)
            totalTime = (totalDistance / 30) * 60; // em minutos
        }

        document.getElementById('totalPoints').textContent = totalPoints;
        document.getElementById('totalDistance').textContent = 
            totalDistance > 0 ? `${totalDistance.toFixed(1)} km` : '-';
        document.getElementById('totalTime').textContent = 
            totalTime > 0 ? `${Math.round(totalTime)} min` : '-';
    }

    openInMaps() {
        if (this.addresses.length === 0) return;

        if (this.isNavigating) {
            this.stopNavigation();
            return;
        }

        // Usar localização atual como ponto de partida se disponível
        let origin;
        if (this.userLocation) {
            origin = `${this.userLocation.lat},${this.userLocation.lng}`;
        } else {
            origin = `${this.addresses[0].lat},${this.addresses[0].lng}`;
        }

        const destination = `${this.addresses[this.addresses.length - 1].lat},${this.addresses[this.addresses.length - 1].lng}`;
        
        let url = `https://www.google.com/maps/dir/${origin}`;
        
        // Adicionar todos os pontos como waypoints se não começar da localização atual
        const startIndex = this.userLocation ? 0 : 1;
        const endIndex = this.addresses.length - 1;
        
        if (endIndex > startIndex) {
            const waypoints = this.addresses.slice(startIndex, endIndex)
                .map(addr => `${addr.lat},${addr.lng}`)
                .join('/');
            if (waypoints) {
                url += `/${waypoints}`;
            }
        }
        
        url += `/${destination}`;

        // Iniciar navegação interna se otimizada
        if (this.isOptimized && confirm('Deseja iniciar navegação com detecção automática de chegada?')) {
            this.startNavigation();
        } else {
            window.open(url, '_blank');
        }
    }

    toggleFullscreen() {
        const mapContainer = document.querySelector('.map-container');
        
        if (!document.fullscreenElement) {
            mapContainer.requestFullscreen().then(() => {
                setTimeout(() => this.map.invalidateSize(), 100);
            });
        } else {
            document.exitFullscreen().then(() => {
                setTimeout(() => this.map.invalidateSize(), 100);
            });
        }
    }

    clearAll() {
        if (this.addresses.length === 0) return;

        if (confirm('Tem certeza que deseja limpar todos os endereços?')) {
            this.addresses = [];
            this.isOptimized = false;
            this.updateAddressList();
            this.updateMap();
            this.updateStats();
            document.getElementById('openMapsBtn').disabled = true;
        }
    }

    showLoading(show) {
        const modal = document.getElementById('loadingModal');
        modal.style.display = show ? 'block' : 'none';
    }

    async getLocationByIP() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            if (data.latitude && data.longitude) {
                this.userLocation = { lat: data.latitude, lng: data.longitude };
                this.map.setView([data.latitude, data.longitude], 11);
                
                this.userMarker = L.marker([data.latitude, data.longitude], {
                    icon: L.divIcon({
                        className: 'user-location-marker approximate',
                        html: '<i class="fas fa-map-marker-alt"></i>',
                        iconSize: [25, 25],
                        iconAnchor: [12, 25]
                    })
                }).addTo(this.map)
                .bindPopup(`Localização aproximada: ${data.city}, ${data.region}`);
            }
        } catch (error) {
            console.log('Erro ao obter localização por IP:', error);
        }
    }

    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&countrycodes=BR`
            );
            const data = await response.json();
            return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        } catch (error) {
            return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
    }

    updateUserLocation(lat, lng) {
        if (this.userMarker) {
            this.userMarker.setLatLng([lat, lng]);
            this.userLocation = { lat, lng };
            
            // Verificar se chegou ao destino
            if (this.isNavigating && this.addresses.length > 0) {
                this.checkDestinationArrival(lat, lng);
            }
        }
    }

    checkDestinationArrival(lat, lng) {
        if (this.currentDestinationIndex >= this.addresses.length) return;
        
        const currentDestination = this.addresses[this.currentDestinationIndex];
        const distance = this.calculateDistance(
            { lat, lng },
            { lat: currentDestination.lat, lng: currentDestination.lng }
        );
        
        // Se estiver a menos de 50 metros do destino
        if (distance < 0.05) {
            this.handleDestinationArrival();
        }
    }

    async handleDestinationArrival() {
        const currentDestination = this.addresses[this.currentDestinationIndex];
        const isLastDestination = this.currentDestinationIndex === this.addresses.length - 1;
        
        const message = isLastDestination 
            ? `Você chegou ao destino final!\n\n${currentDestination.originalAddress || currentDestination.address}\n\nDeseja finalizar a navegação?`
            : `Você chegou ao destino ${this.currentDestinationIndex + 1}!\n\n${currentDestination.originalAddress || currentDestination.address}\n\nDeseja continuar para o próximo destino?`;
        
        if (confirm(message)) {
            if (isLastDestination) {
                this.finishNavigation();
            } else {
                this.currentDestinationIndex++;
                this.updateNavigationProgress();
            }
        }
    }

    startNavigation() {
        if (this.addresses.length === 0) return;
        
        this.isNavigating = true;
        this.currentDestinationIndex = 0;
        document.getElementById('openMapsBtn').innerHTML = '<i class="fas fa-stop"></i> Parar Navegação';
        document.getElementById('openMapsBtn').onclick = () => this.stopNavigation();
        this.updateNavigationProgress();
    }

    stopNavigation() {
        this.isNavigating = false;
        document.getElementById('openMapsBtn').innerHTML = '<i class="fas fa-external-link-alt"></i> Abrir no Maps';
        document.getElementById('openMapsBtn').onclick = () => this.openInMaps();
        this.clearNavigationProgress();
    }

    finishNavigation() {
        this.isNavigating = false;
        alert('Navegação finalizada com sucesso!');
        this.stopNavigation();
    }

    updateNavigationProgress() {
        // Atualizar visual da lista mostrando progresso
        this.updateAddressList();
    }

    clearNavigationProgress() {
        this.currentDestinationIndex = 0;
        this.updateAddressList();
    }

    setupAutofocus() {
        // Configurar autofoco inteligente
        document.addEventListener('click', (e) => {
            if (e.target.id === 'cepInput' || e.target.id === 'addressInput') {
                setTimeout(() => e.target.focus(), 100);
            }
        });

        // Autofocus no primeiro campo ao carregar
        setTimeout(() => {
            const cepInput = document.getElementById('cepInput');
            if (cepInput) cepInput.focus();
        }, 1000);
    }
}

// Inicializar aplicação
let routeOptimizer;

document.addEventListener('DOMContentLoaded', () => {
    routeOptimizer = new RouteOptimizer();
});

// Adicionar service worker para cache (PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registrado com sucesso:', registration);
            })
            .catch((registrationError) => {
                console.log('SW falhou ao registrar:', registrationError);
            });
    });
}
