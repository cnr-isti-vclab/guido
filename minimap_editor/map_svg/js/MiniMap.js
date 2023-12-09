/**
 * @file Questo file contiene la classe MiniMap.
 * 
 * @requires utils
 * @requires svgMatrix
 * @requires controlsBarData
 */

/**
 * @typedef {Object} VisibilityRange
 * @property {Number} P0 - Range di visibilità per i pano con priorità 0
 * @property {Number} P1 - Range di visibilità per i pano con priorità 1
 * @property {Number} P2 - Range di visibilità per i pano con priorità 2
 */

/**
 * @typedef {Object} PanosVisibility
 * @property {Boolean} id - Visibilità del pano con ID specificato
 */

/**
 * @typedef {Object} MiniMapDOMMapElements
 * @property {DOMMapElementsSVG} svg - Oggetto contenente i riferimenti agli elementi SVG della mappa
 * @property {Object} background - Oggetto contenente i riferimenti agli elementi SVG dello sfondo
 * @property {DOMMapElementsPanosElements} panosElements - Oggetto contenente i riferimenti agli elementi SVG dei pano
 */

/**
 * @typedef {Object} DOMMapElementsSVG
 * @property {Number} margin - Margine dello SVG
 * @property {DOMRect} originalViewBox - Oggetto contenente le dimensioni e le coordinate della viewBox originale dello SVG
 * @property {DOMPoint} translation - Oggetto contenente le coordinate di traslazione della viewBox dello SVG
 * @property {DOMPoint} scale - Oggetto contenente le coordinate di scala della viewBox dello SVG
 * @property {DOMPoint} scaleLimit - Oggetto contenente i limiti di scala della viewBox dello SVG
 * @property {Object} viewPortSize - Oggetto contenente le dimensioni del container dello SVG in dimensioni SVG
 * @property {DOMPoint} containerCenter - Oggetto contenente le coordinate del centro del container dello SVG in coordinate utente
 * @property {SVGElement} DOMElement - Elemento SVG della mappa
 */

/**
 * @typedef {Object} DOMMapElementsPanosElements
 * @property {DOMPoint} translation - Oggetto contenente le coordinate di traslazione dei pano
 * @property {PanosElementsVisibilityArea} visibilityArea - Oggetto contenente informazioni relative all'area di visibilità
 * @property {PanosElementsMarkers} markers - Oggetto contenente informazioni relative ai marker
 * @property {PanosElementsTooltips} tooltips - Oggetto contenente informazioni relative ai tooltip
 */

/**
 * @typedef {Object} PanosElementsVisibilityArea
 * @property {SVGElement} DOMElement - Elemento SVG dell'area di visibilità
 */

/**
 * @typedef {Object} PanosElementsMarkers
 * @property {Number} markerRadius - Raggio degli elementi grafici che rappresentano i marker
 * @property {Number} markerStrokeWidth - Spessore del bordo degli elementi grafici che rappresentano i marker
 * @property {Number} markerHoverScaleFactor - Fattore di scala degli elementi grafici che rappresentano i marker al passaggio del mouse
 * @property {SVGGElement} DOMElement - Elemento SVG del gruppo che contiene i marker
 * @property {Array} DOMElements - Array contenente i riferimenti agli elementi SVG dei marker
 */

/**
 * @typedef {Object} PanosElementsTooltips
 * @property {String} placement - Posizione del tooltip rispetto al marker
 * @property {Number} angleRadius - Raggio dell'angolo del tooltip
 * @property {Number} pinOffset - Offset del pin del tooltip
 * @property {Number} padding - Padding del tooltip
 * @property {Number} pinDistance - Distanza del pin del tooltip dal marker
 * @property {Boolean} showAll - Flag che indica se mostrare tutti i tooltip
 * @property {Array} showScaleThreshold - Array contenente i valori di scala dello SVG a cui mostrare i tooltip
 * @property {SVGGElement} DOMElement - Elemento SVG del gruppo che contiene i tooltip
 * @property {Array} DOMElements - Array contenente i riferimenti agli elementi SVG dei tooltip
 */

/**
 * @constructor MiniMap
 * 
 * @classdesc
 * Questa classe contiene i dati del dataset e le informazioni relative alla mappa SVG.
 * 
 * @property {Object} #dataset - Oggetto dataset contenente i dati dei tour, set e pano
 * @property {Number} #currentTourIndex - Indice del tour corrente
 * @property {Number} #currentSetIndex - Indice del set corrente
 * @property {Number} #currentPanoIndex - Indice del pano corrente
 * @property {Number} #currentPanoYaw - Yaw del pano corrente
 * @property {Number} #widthMax - Larghezza massima tra tutti i set del dataset
 * @property {Object} #currentSetPadding - Oggetto contenente i valori di padding superiore e sinistro del set corrente
 * @property {Object} #visibilityRange - Range di visibilità dei pano
 * @property {Array} #panosVisibility - Array di visibilità dei pano
 * @property {Number} #editorMode - Modalità di editor
 * @property {Object} #modeTypes - Oggetto contenente le modalità di editor
 * @property {String} #saveURL - URL del server di salvataggio
 * @property {Number} #saveTimeout - Timeout di salvataggio
 * @property {Boolean} #changesUnsaved - Flag che indica se ci sono modifiche non salvate
 * @property {Boolean} #saveTimeoutRunning - Flag che indica se è in corso il timeout di salvataggio
 * @property {MiniMapDOMMapElements} #DOMMapElements - Oggetto contenente le informazioni relative agli elementi SVG della mappa
 */

import * as utils from './utils.js';
import * as svgMatrix from './svgMatrix.js';
import controlsBarData from './controlsBarData.js';

export default class MiniMap {
    #dataset = null;

    // dataset infos
    #currentTourIndex = -1;
    #currentSetIndex = -1;
    #currentPanoIndex = -1;
    #currentPanoYaw = 0; // CHECK: yaw
    #widthMax = 0;
    #currentSetPadding = {top: 0, left: 0};
    #visibilityRange = {
        P0: "100",
        P1: "150",
        P2: "200"
    };
    #panosVisibility = null;
    #editorMode = 0;
    #modeTypes = { DEFAULT: 0, EDIT_VISIBILITY: 1 }
    #saveURL = 'http://127.0.0.1:3000/';
    #saveTimeout = 5000;
    #changesUnsaved = false;
    #saveTimeoutRunning = false;

    // DOM infos
    #DOMMapElements = {
        svg: {
            margin: 0,
            originalViewBox: new DOMRect(),
            translation: new DOMPoint(0, 0),
            scale: new DOMPoint(1, 1),
            scaleLimit: new DOMPoint(0.00005, 0.00005),
            viewPortSize: {
                width: 0,
                height: 0,
            },
            containerCenter: new DOMPoint(),
            DOMElement: null,
        },
        background: {
            DOMElement: null,
        },
        panosElements: {
            translation: new DOMPoint(),
            visibilityArea: {
                DOMElement: null,
            },
            markers: {
                markerRadius: 8,
                markerStrokeWidth: 3,
                markerHoverScaleFactor: 1.5,
                DOMElement: null,
                DOMElements: []
            },
            tooltips: {
                placement: "T",
                angleRadius: 5,
                pinOffset: 5,
                padding: 5,
                pinDistance: 10,
                showAll: false,
                showScaleThreshold: [0.25, 0.5, 1],
                DOMElement: null,
                DOMElements: []
            },
        }
    };
  
    /**
     * @module MiniMapMethods
     */
    
    // Getters dataset
    get dataset() {
        return this.#dataset;
    }
  
    get currentTour() {
        return this.#dataset.tours[this.#currentTourIndex];
    }
  
    get currentSet() {
        return this.#dataset.tours[this.#currentTourIndex].sets[this.#currentSetIndex];
    }
  
    get currentPano() {
        return this.#dataset.tours[this.#currentTourIndex].sets[this.#currentSetIndex].panos[this.#currentPanoIndex];
    }

    get currentSetWidth() {
        return (this.currentSet.boundingbox["easting_max"] - this.currentSet.boundingbox["easting_min"]);
    }

    get currentSetHeight() {
        return (this.currentSet.boundingbox["northing_max"] - this.currentSet.boundingbox["northing_min"]);
    }

    // CHECK: yaw
    get currentPanoYaw() {
        return this.#currentPanoYaw;
    }
  
    get visibilityRange() {
        return this.#visibilityRange;
    }
    
    get panosVisibility() {
        return this.#panosVisibility;
    }

    get editorMode() {
        return this.#editorMode;
    }

    get saveURL() {
        return this.#saveURL;
    }

    get saveTimeout() {
        return this.#saveTimeout;
    }

    get changesUnsaved() {
        return this.#changesUnsaved;
    }

    get saveTimeoutRunning() {
        return this.#saveTimeoutRunning;
    }

    getPanoVisibility (panoID) {
        return this.#panosVisibility[panoID];
    }

    // Getters DOM

    get DOMMapElements() {
        return this.#DOMMapElements;
    }

    get svg() {
        return this.#DOMMapElements.svg;
    }

    get svgMargin() {
        return this.svg.margin;
    }

    get svgViewBoxBaseVal() {
        return this.svg.DOMElement.viewBox.baseVal;
    }

    get svgOriginalViewBox() {
        return this.svg.originalViewBox;
    }

    get svgViewPortSize() {
        return this.svg.viewPortSize;
    }

    get svgContainerCenter() {
        return this.svg.containerCenter;
    }

    get svgTranslationValues() {
        return this.svg.translation;
    }
    
    get svgScaleValues() {
        return this.svg.scale;
    }

    get svgScaleLimit() {
        return this.svg.scaleLimit;
    }

    get background() {
        return this.#DOMMapElements.background;
    }

    get panosElementsTranslation() {
        return this.#DOMMapElements.panosElements.translation;
    }

    get visibilityArea() {
        return this.#DOMMapElements.panosElements.visibilityArea;
    }

    get markers() {
        return this.#DOMMapElements.panosElements.markers;
    }

    get tooltips() {
        return this.#DOMMapElements.panosElements.tooltips;
    }

    get tooltipsShowingPriorityLevel () {
        if (this.svgScaleValues.x <= this.tooltips.showScaleThreshold[0]) {
            return 0;
        } else if (this.svgScaleValues.x <= this.tooltips.showScaleThreshold[1]) {
            return 1;
        } else {
            return 2;
        }
    }

    getMarkerDOMElement (panoIndex) {
        return this.markers.DOMElements[panoIndex];
    }

    getToolTipDOMElement (panoIndex) {
        return this.tooltips.DOMElements[panoIndex];
    }
  
    // Setters dataset
    set visibilityRange(range) {
        this.#visibilityRange = range;
    }

    set editorMode(mode) {
        if (typeof mode === "string") {
            mode = this.#modeTypes[mode];
        } 
        
        this.#editorMode = mode;
    }

    set saveURL(url) {
        this.#saveURL = url;
    }

    set saveTimeout(timeout) {
        this.#saveTimeout = timeout;
    }

    set changesUnsaved(value) {
        this.#changesUnsaved = value;
    }

    set saveTimeoutRunning(value) {
        this.#saveTimeoutRunning = value;
    }

    // Setters DOM
    set svgMargin(margin) {
        this.svg.margin = margin;
    }
  
    // Methods

    /**
     * Inizializza l'oggetto MiniMap.
     * 
     * @param {String} datasetURL - URL del dataset
     * @param {Number} panoID - ID del pano da visualizzare
     */
    async init (datasetURL, panoID = -1) {
        try {
            // get dataset
            const response = await fetch(datasetURL);
            this.#dataset = await response.json();
        
            // Create controls bar data object
            const controlsBar = controlsBarData(utils, this);
        
            // get SVG element
            this.#DOMMapElements.svg.DOMElement = document.getElementById("map_svg");
            
            const scopeLevel = panoID === -1 ? -1 : 2;
    
            [this.#currentTourIndex, this.#currentSetIndex, this.#currentPanoIndex] = this.findIndices(panoID, scopeLevel);

            // init widthMax
            for (const tour of this.#dataset.tours) {
                for (const set of tour.sets) {
                    const setWidth = (set.boundingbox["easting_max"] - set.boundingbox["easting_min"]);
                    this.#widthMax = this.#widthMax > setWidth ? this.#widthMax : setWidth;
                }
            }
    
            // init SVG margin
            this.svgMargin = this.#widthMax * 0.1;
    
            this.updateMap();

            // mouse wheel, trackpad pitch (CHECK)
            this.svg.DOMElement.addEventListener('wheel', (e) => {utils.mapSVGWheelZoom (e, this)}, {passive: false});
    
            // mouse drag
            this.svg.DOMElement.addEventListener('mousedown', (e) => {utils.mapSVGClickDrag (e, this)});
        
            // init map controls
            this.initMapControls(controlsBar);
        
            // Add event handlers
            document.getElementById("btn_map_open").addEventListener("click", utils.openIconClick);
        
            document.querySelector("#minimap_dialog > button").addEventListener("click", () => {
              document.getElementById("minimap_dialog").close();
            });
        
            const m = document.getElementById("map_container");
            const resizeObserver = new ResizeObserver(m => {
              utils.updateContainer(this);
            });
            resizeObserver.observe(m);
    
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Recupera gli indici degli array del dataset di tour, set e pano (a seconda del livello di scope selezionato) a partire dall'ID del pano fornito in input.
     * 
     * @param {Number} panoID - ID del pano
     * @param {Number} scopeLevel - Livello di scope (0: panos, 1: sets, 2: tours)
     * 
     * @returns {Array} - Array contenente gli indici di tour, set e pano oppure null se non è presente nel dataset il pano con ID specificato
     */
    findIndices (panoID, scopeLevel=2) {
        
        let tour = this.#currentTourIndex;
        let set = this.#currentSetIndex;
        let pano = this.#currentPanoIndex;

        switch (scopeLevel) {
            case 0:
                pano = this.currentSet.panos.findIndex(p => p.id === panoID);
                break;
            case 1:
                pano = -1;
                set = -1;

                while (pano === -1 && set < this.currentTour.sets.length-1) {
                    set++;

                    pano = this.currentTour.sets[set].panos.findIndex(p => p.id === panoID);
                }

                break
            case 2:
                pano = -1;
                tour = -1;

                while (pano === -1 && tour <= this.#dataset.tours.length-1) {
                    tour++;
                    set = -1;
                    
                    while (pano === -1 && set < this.#dataset.tours[tour].sets.length-1) {
                        set++;
                        
                        pano = this.#dataset.tours[tour].sets[set].panos.findIndex(p => p.id === panoID);
                    }
                }

                break;
            case -1:
                pano = -1;
                tour = -1;

                while (pano === -1 && tour < this.#dataset.tours.length-1) {
                    tour++;
                    set = -1;

                    while (pano === -1 && set < this.#dataset.tours[tour].sets.length-1) {
                        set++;

                        pano = this.#dataset.tours[tour].sets[set].panos.findIndex(p => !p.skip);
                    }
                }

                break;
                
            default:
                pano = -1;
                set = -1;
                tour = -1;

                break;
        }

        // check pano skip
        if (pano !== -1) {
            pano = this.#dataset.tours[tour].sets[set].panos[pano].skip ? -1 : pano;
        }

        if (pano === -1) {
            throw new Error("Pano not found");
        }

        return [tour, set, pano];
    }

    /**
     * Aggiorna la mappa.
     */
    updateMap () {

        // CHECK: yaw
        this.#currentPanoYaw = this.currentPano.initialYaw;

        // this.initSetSize();
        this.initPanosVisibility();

        // add SVG map style
        utils.addMapStyle (this.svg.DOMElement);

        // init SVG map
        this.initMapSVG();
    }

    /**
     * Inizializza l'array di visibilità dei pano.
     */
    initPanosVisibility() {
        this.#panosVisibility = {};
        
        this.updatePanosVisibility();
    }

    /**
     * Aggiorna l'array di visibilità dei pano.
     */
    updatePanosVisibility() {
        // resetta visibilità
        for (const pano of this.currentSet.panos) {
            this.#panosVisibility[pano.id] = true;
        }

        // escludi skipLinks
        for (const skiplink of this.currentPano.skipLinks) {
            this.#panosVisibility[skiplink] = false;
        }

        // escludi esterni ai range di visibilità in base alle priorità
        for (const pano of this.currentSet.panos) {
            if (this.currentPano.id != pano.id && this.#panosVisibility[pano.id]) {
                let distance = Math.sqrt(
                    Math.pow(this.currentPano.translation[0] - pano.translation[0], 2) +
                    Math.pow(this.currentPano.translation[1] - pano.translation[1], 2)
                );

                if (distance > this.#visibilityRange[`P${pano.priority}`]) {
                    this.#panosVisibility[pano.id] = false;
                }
            }
        }
    }

    /**
     * Inizializza l'elemento SVG della mappa.
     */
    initMapSVG () {

        // Calcola il padding del set
        const containerBB = this.svg.DOMElement.parentNode.getBoundingClientRect();
        const ratio = containerBB.height/containerBB.width;

        const height = this.currentSetHeight > this.#widthMax * ratio ? this.currentSetHeight : this.#widthMax * ratio;

        this.#currentSetPadding = {
            top: (height-this.currentSetHeight)/2,
            left: (this.#widthMax-this.currentSetWidth)/2,
        }

        // Calcola le dimensioni dello SVG
        const svgWidth = ((this.svgMargin + this.#currentSetPadding.left) * 2) + this.currentSetWidth;
        const svgHeight = ((this.svgMargin + this.#currentSetPadding.top) * 2) + this.currentSetHeight;

        // Imposta la viewBox dello SVG
        this.svg.DOMElement.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

        // Salva i valori iniziali della viewBox dello SVG
        this.svg.originalViewBox.x = this.svgViewBoxBaseVal.x;
        this.svg.originalViewBox.y = this.svgViewBoxBaseVal.y;
        this.svg.originalViewBox.width = this.svgViewBoxBaseVal.width;
        this.svg.originalViewBox.height = this.svgViewBoxBaseVal.height;

        // Calcola le dimensioni del container dello SVG (che rappresenteranno il "viewport" dello SVG) e il relativo centro
        this.updateSVGContainer ();

        // Aggiunge il background
        this.background.DOMElement = utils.addBackground(this.svg.DOMElement, this.svgViewBoxBaseVal.width, this.svgViewBoxBaseVal.height, "#fef8f1");

        // Inizializza la posizione degli elementi legati ai pano
        this.updateSVGPanosElementsPosition();

        // Sposta la viewBox dello SVG in modo che il pano corrente sia visibile
        this.moveSVGViewportToCurrentPano();

        // Aggiunge l'elemento grafico che individua l'area di visibilità
        const translation = [this.panosElementsTranslation.x + this.currentPano.translation[0], this.panosElementsTranslation.y - this.currentPano.translation[1]];

        this.visibilityArea.DOMElement = utils.addVisibilityArea (this.svg.DOMElement, translation, this.visibilityRange);

        // init markers group
        let markersSVGGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        markersSVGGroup.setAttribute("id", "markers");
        markersSVGGroup.setAttribute("transform", `translate(${this.panosElementsTranslation.x}, ${this.panosElementsTranslation.y}) scale(1, -1)`);
        this.svg.DOMElement.appendChild(markersSVGGroup);
        this.markers.DOMElement = markersSVGGroup;

        // init tooltips group
        let tooltipsSVGGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        tooltipsSVGGroup.setAttribute("id", "tooltips");
        tooltipsSVGGroup.setAttribute("transform", `translate(${this.panosElementsTranslation.x}, ${this.panosElementsTranslation.y}) scale(1, 1)`);
        this.svg.DOMElement.appendChild(tooltipsSVGGroup);
        this.tooltips.DOMElement = tooltipsSVGGroup;

        // add markers and tooltips to respective groups for each pano
        for (const [i, pano] of this.currentSet.panos.entries()) {
            this.markers.DOMElements.push(utils.addMarker (this, i));
            
            this.tooltips.DOMElements.push(utils.addToolTip (this.tooltips, pano.translation, pano.label));

            if (pano.skip) {
                this.markers.DOMElements[i].classList.add("skip");
                this.tooltips.DOMElements[i].classList.add("skip");
            }
        }
    }

    initMapControls (controlsBar) {

        let mapControls = document.getElementById("map_controls");
      
        let coontrolsBarStyle = document.createElement("style");
        coontrolsBarStyle.textContent = '';
      
        for (const control of controlsBar.controls) {
          let container = document.createElement("div");
          container.classList.add("controls_container");
      
          for (const [i, btn] of control.entries()) {
      
            // add style to style tag
            coontrolsBarStyle.textContent += `
              .${btn.className}::before {
                -webkit-mask-image: url(${controlsBar.iconsPath}${btn.icon}.svg);
                mask-image: url(${controlsBar.iconsPath}${btn.icon}.svg);
              }`;
      
            if (btn.iconAlt) {
              coontrolsBarStyle.textContent += `
                .${btn.classNameAlt}::before {
                  -webkit-mask-image: url(${controlsBar.iconsPath}${btn.iconAlt}.svg);
                  mask-image: url(${controlsBar.iconsPath}${btn.iconAlt}.svg);
                }`;
            }
      
            // add button to container
            utils.addControlButton(container, btn);
      
            if (i < control.length-1) {
              utils.addControlSeparator(container);
            }
          }
      
          mapControls.appendChild(coontrolsBarStyle);
          mapControls.appendChild(container);
        }
    }

    /**
     * Effettua una traslazione dello SVG modificandone i valori x e y della viewBox.
     * 
     * @param {Number} tX - Valore di traslazione sull'asse x
     * @param {Number} tY - Valore di traslazione sull'asse y
     */
    svgTranslate (tX, tY) {
        this.svg.translation.x += tX;
        this.svg.translation.y += tY;

        this.svgViewBoxBaseVal.x = this.svg.originalViewBox.x + this.svg.translation.x;
        this.svgViewBoxBaseVal.y = this.svg.originalViewBox.y + this.svg.translation.y;
    }

    /**
     * Effettua uno scaling dello SVG modificandone i valori width e height della viewBox.
     * 
     * @param {Number} sX - Valore di scaling sull'asse x
     * @param {Number} sY - Valore di scaling sull'asse y
     */
    svgScale (sX, sY) {
        this.svg.scale.x *= sX;
        this.svg.scale.y *= sY;

        this.svgViewBoxBaseVal.width = this.svg.originalViewBox.width * this.svg.scale.x;
        this.svgViewBoxBaseVal.height = this.svg.originalViewBox.height * this.svg.scale.y;
    }

    /**
     * Resettta i valori di traslazione e scaling dello SVG a quelli iniziali.
     */
    svgTransformReset () {
        this.svg.translation.x = 0;
        this.svg.translation.y = 0;
        this.svg.scale.x = 1;
        this.svg.scale.y = 1;

        this.svgViewBoxBaseVal.x = this.svg.originalViewBox.x;
        this.svgViewBoxBaseVal.y = this.svg.originalViewBox.y;
        this.svgViewBoxBaseVal.width = this.svg.originalViewBox.width;
        this.svgViewBoxBaseVal.height = this.svg.originalViewBox.height;
    }

    /**
     * Converte le coordinate del punto passato come parametro in coordinate SVG.
     * 
     * @param {DOMPoint} point - Punto da convertire
     * 
     * @returns {DOMPoint} - Punto convertito
     */
    toSVGCoordSystem (point) {
        const ctm = this.svg.DOMElement.getScreenCTM().inverse();
        return point.matrixTransform(ctm);
    }

    /**
     * Converte le coordinate del punto passato come parametro in coordinate utente.
     * 
     * @param {DOMPoint} point - Punto da convertire
     * 
     * @returns {DOMPoint} - Punto convertito
     */
    toClientCoordSystem (point) {
        const ctm = this.svg.DOMElement.getScreenCTM();
        return point.matrixTransform(ctm);
    }

    /**
     * Aggiorna la posizione degli elementi legati ai pano tenendo conto del margine di sicurezza.
     */
    updateSVGPanosElementsPosition () {
        this.#DOMMapElements.panosElements.translation.x = this.svgMargin + this.#currentSetPadding.left;
        this.#DOMMapElements.panosElements.translation.y = this.svgMargin + this.#currentSetPadding.top + this.currentSetHeight;
    }

    /**
     * Calcola le dimensioni della porzione di SVG visibile in base alla dimensione del container e il relativo centro.
     */
    updateSVGContainer () {
        const containerBB = this.svg.DOMElement.parentNode.getBoundingClientRect();

        let ratio = containerBB.height/containerBB.width;

        this.svgViewPortSize.width = this.svg.originalViewBox.width;
        this.svgViewPortSize.height = this.svg.originalViewBox.width * ratio;

        this.svg.containerCenter.x = containerBB.x+(containerBB.width/2);
        this.svg.containerCenter.y = containerBB.y+(containerBB.height/2);
    }

    /**
     * Muove il viewport dello SVG in modo che il marker del pano corrente sia visibile.
     */
    moveSVGViewportToCurrentPano () {

        const viewPortCenter = this.toSVGCoordSystem(this.svgContainerCenter);

        let translation = new DOMPoint(
            (this.panosElementsTranslation.x + this.currentPano.translation[0]) - viewPortCenter.x,
            (this.panosElementsTranslation.y - this.currentPano.translation[1]) - viewPortCenter.y
        );

        utils.translationInBounds(this, translation)

        this.svgTranslate(translation.x, translation.y);
    }

    /**
     * Restituisce la stringa corrispondente alla modalità di editor.
     * 
     * @param {number} modeNumber - Numero della modalità di editor
     * 
     * @returns {string} - Stringa corrispondente alla modalità di editor
     */
    getEditorModeString (modeNumber) {
        return Object.keys(this.#modeTypes).find(key => this.#modeTypes[key] === modeNumber);
    }

    /**
     * Cambia la modalità di editor in quella specificata oppure in quella default.
     */
    toggleEditorMode (mode) {
        if (typeof mode === "string") {
            mode = this.#modeTypes[mode];
        }

        if (mode === this.#editorMode) {
            this.#editorMode = 0;
        } else {
            this.#editorMode = mode;
        }
    }

    /**
     * Cambia la visibilità del pano con ID specificato.
     * 
     * @param {number} id - ID del pano
     */
    togglePanoVisibility (id) {
        // Aggiorna la visibilità del pano selezionato nell'array di visibilità
        this.#panosVisibility[id] = !this.#panosVisibility[id];

        // Aggiorna la visibilità del pano selezionato negli skipLinks del pano corrente e viceversa
        const skipLinkIndex = this.currentPano.skipLinks.indexOf(id);
        const pano = this.currentSet.panos.find(p => p.id === id);

        if (skipLinkIndex === -1) {
            this.currentPano.skipLinks.push(id);
            pano.skipLinks.push(this.currentPano.id);
        } else {
            this.currentPano.skipLinks.splice(skipLinkIndex, 1);
            pano.skipLinks.splice(pano.skipLinks.indexOf(this.currentPano.id), 1);
        }
    }

    /**
     * Cambia il valore di verità rispetto al fatto che tutti i tooltip siano visibili o meno.
     */
    toggleShowAllTooltips () {
        this.tooltips.showAll = !this.tooltips.showAll;
    }

    /**
     * Salva le modifiche effettuate al dataset sul server.
     */
    saveDataset () {
        if (this.saveTimeoutRunning) {
            this.changesUnsaved = true;
        } else {
            console.log("Saving log: avvio salvataggio modifiche");
            utils.sendData(this.dataset, this.saveURL);
    
            this.saveTimeoutRunning = true;
    
            setTimeout(() => {
                this.saveTimeoutRunning = false;
                if (this.changesUnsaved) {
                    this.saveDataset();
                    this.changesUnsaved = false;
                }
            }, this.saveTimeout);
        }
    }

    // CHECK: yaw
    /**
     * Modifica la rotazione del marker del pano corrente.
     * 
     * @param {number} yaw - Valore di rotazione
     */
    updateCurrentPanoYaw (yaw) {
    }

    // TODO
    togglePanoSkip (id) {
    }

    /**
     * Permette di cambiare il pano corrente in base all'ID specificato cercandolo all'interno del set corrente.
     * 
     * @param {Number} panoIndex - L'indice del pano che deve diventare il corrente.
     * @param {boolean} clickInMinimap - Flag che indica se l'interazione è avvenuta nella minimappa
     */
    changePano (panoIndex, clickInMinimap = false) {

        const panoID = this.currentSet.panos[panoIndex].id;

        if (this.currentPano.id !== panoID) {
            // Salvataggio temporaneo dell'indice e della priorità del pano corrente
            const tempIndex = this.#currentPanoIndex;
            const tempPriority = this.currentPano.priority;

            // Aggiorna l'indice del pano corrente
            this.#currentPanoIndex = panoIndex;

            // CHECK: yaw
            this.#currentPanoYaw = this.currentPano.initialYaw;

            // Aggiorna la visibilità dei pano
            this.updatePanosVisibility();

            // Cambia il marker da corrente a non corrente
            utils.changePinType (tempIndex, this);

            // Aggiorna la visibilità del tooltip associato
            if (this.tooltips.showAll && tempPriority >= this.tooltipsShowingPriorityLevel) {
                this.getToolTipDOMElement(tempIndex).classList.toggle("invisible");
            }

            // Cambia il marker da non corrente a corrente
            utils.changePinType (this.#currentPanoIndex, this);

            // Se showAll è disabilitato e l'interazione avviene nella minimappa, essendo diventato ora e.target il pin corrente, non ha un listener per il mouseleave, quindi occorre togliere manualmente la classe invisible al tooltip associato;
            // Se showAll è abilitato, il tooltip era visibile e deve essere nascosto in quanto ora è il corrente
            if ((!this.tooltips.showAll && clickInMinimap) || (this.tooltips.showAll && this.currentPano.priority >= this.tooltipsShowingPriorityLevel)) {
                this.getToolTipDOMElement(this.#currentPanoIndex).classList.toggle("invisible");
            }

            utils.moveVisibilityArea(this.visibilityArea.DOMElement, this.panosElementsTranslation, this.currentPano.translation);

            // Aggiorna le classi dei marker
            utils.updateMarkers (this.markers.DOMElements, this.currentPano.id, this.#panosVisibility, this.currentSet.panos);

            // Muove la viewBox dello SVG in modo che il marker del pano corrente sia visibile
            if (!clickInMinimap) {
                this.moveSVGViewportToCurrentPano();
            }
        }
    }

    /**
     * Permette di cambiare il pano corrente in base all'ID specificato cercandolo tra tutti i set all'interno del tour corrente oppure tra tutti i set di tutti i tour disponibili a seconda dello skipLevel scelto e aggiornando la minimappa.
     * 
     * @param {number} panoid - ID del pano
     * @param {number} scopeLevel - Livello di scope (0: panos, 1: sets, 2: tours)
     */
    changeMap (panoID, scopeLevel = 2) {

        const [t, s, p] = this.findIndices(panoID, scopeLevel);

        if (t === this.#currentTourIndex && s === this.#currentSetIndex) {
            this.changePano(p);
        } else {
            [this.#currentTourIndex, this.#currentSetIndex, this.#currentPanoIndex] = [t, s, p];

            // resetto elemento SVG del DOM eliminando tutti i figli
            this.svg.DOMElement.replaceChildren();

            // resetto valori di traslazione e scaling
            this.svg.translation.x = 0;
            this.svg.translation.y = 0;
            this.svg.scale.x = 1;
            this.svg.scale.y = 1;

            // resetto i campi di #DOMMapElements che contenevano riferimenti ai precedenti elementi SVG
            this.markers.DOMElements = []
            this.tooltips.DOMElements = []

            // aggiorno la mappa
            this.updateMap();
        }
    }
}