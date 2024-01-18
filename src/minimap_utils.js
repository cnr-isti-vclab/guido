/**
 * @file Funzioni di utilità per la gestione della mappa SVG.
 * 
 * @requires svgMatrix
 */

import MiniMap from './minimap.js';
import * as svgMatrix from './svgMatrix.js';

// SECTION GLOBAL VARIABLES ///

let pinFillColorCurrent = "#4285f4";
let pinStrokeColorCurrent = "#1a5ea8";

let pinFillColorP0 = "#ea4335";
let pinStrokeColorP0 = "#b21511";

let pinFillColorP1 = "#fbbc05";
let pinStrokeColorP1 = "#b28f11";

let pinFillColorP2 = "#43EA35";
let pinStrokeColorP2 = "#15B211";

let pinFillColorModified = "#9c27b0";
let pinStrokeColorModified = "#6a1b9a";

let svgStyleString = `
    .pin {}

    .current {
        fill: ${pinFillColorCurrent};
        stroke: ${pinStrokeColorCurrent};
    }

    .visible_P0 {
        fill: ${pinFillColorP0};
        stroke: ${pinStrokeColorP0};
    }

    .not_visible_P0 {
        fill: ${toGrayScale(pinFillColorP0)};
        stroke: ${toGrayScale(pinStrokeColorP0)};
    }

    .visible_P1 {
        fill: ${pinFillColorP1};
        stroke: ${pinStrokeColorP1};
    }

    .not_visible_P1 {
        fill: ${toGrayScale(pinFillColorP1)};
        stroke: ${toGrayScale(pinStrokeColorP1)};
    }

    .visible_P2 {
        fill: ${pinFillColorP2};
        stroke: ${pinStrokeColorP2};
    }

    .not_visible_P2 {
        fill: ${toGrayScale(pinFillColorP2)};
        stroke: ${toGrayScale(pinStrokeColorP2)};
    }

    .visibility_area  {
        stroke-width: 2px;
        opacity: 0.2;
    }

    .visibility_area[data-priority="0"] {
        fill: ${pinFillColorP0};
        stroke: ${pinStrokeColorP0};
    }

    .visibility_area[data-priority="1"] {
        fill: ${pinFillColorP1};
        stroke: ${pinStrokeColorP1};
    }

    .visibility_area[data-priority="2"] {
        fill: ${pinFillColorP2};
        stroke: ${pinStrokeColorP2};
    }

    .tooltip {
        pointer-events: none;
        opacity: 0.8;
    }

    .tooltip>text {
        fill: cornsilk;
        font-size: 10pt;
        font-family: sans-serif;
        font-weight: bold;
        text-anchor: middle;
        dominant-baseline: central;
    }

    .invisible {
        visibility: hidden;
    }

    .dimmed {
        opacity: 0.3;
    }
    
    .skip {
        visibility: hidden;
    }

    .hover {
        cursor: pointer;
        opacity: 1;
        visibility: visible;
    }`;

/// SECTION UTILS ///

/**
 * @module utils.misc
 */

/**
 * 
 * @param {string} hex - Il colore esadecimale da convertire.
 * @returns {Array.<number>} rgb - Un array contenente i valori RGB del colore convertito.
 */
function hexToRgb(hex) {
    // Rimuovi il carattere '#' se presente
    hex = hex.replace(/^#/, '');

    // Converti i primi due caratteri in valore esadecimale per il canale rosso
    // Gli altri due per il canale verde e gli ultimi due per il canale blu
    const v = parseInt(hex, 16);
    const r = (v >> 16) & 255;
    const g = (v >> 8) & 255;
    const b = v & 255;

    return [r, g, b];
}

/**
 * 
 * @param {number} r - Il valore del canale rosso.
 * @param {number} g - Il valore del canale verde.
 * @param {number} b - Il valore del canale blu.
 * @returns {string} hex - Il colore esadecimale convertito.
 */
function rgbToHex(r, g, b) {
    // Assicurati che i valori siano compresi tra 0 e 255
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    // Converti i valori RGB in esadecimale e uniscili
    const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

    return `#${hex}`;
}

/**
 * Converte un colore esadecimale in scala di grigi.
 * 
 * @param {string} hexColor - Il colore esadecimale da convertire.
 * @returns {string} grayColor - Il colore esadecimale convertito.
 */
function toGrayScale(hexColor) {
    // Converti il colore esadecimale in RGB
    const [r, g, b] = hexToRgb(hexColor);

    // Calcola la scala di grigi
    const grayValue = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    // Converti il valore di scala di grigi in un colore HEX
    const grayColor = rgbToHex(grayValue, grayValue, grayValue);

    return grayColor;
}

/**
 * Genera il nome della classe da assegnare al marker in base alla sua visibilità e priorità.
 * 
 * @param {boolean} visibility - La visibilità del pano.
 * @param {number} priority - La priorità del pano.
 * 
 * @returns {string} className - Il nome della classe da assegnare al marker.
 */
function generateMarkerClassName (visibility, priority) {
    return visibility ? `visible_P${priority}` : `not_visible_P${priority}`;
}

/**
 * Scambia il valore di due attributi di un elemento.
 *
 * @param {HTMLElement} element - L'elemento di cui scambiare gli attributi.
 * @param {string} attrA - Il nome del primo attributo.
 * @param {string} attrB - Il nome del secondo attributo.
 */ 
function attributeSwitch (element, attrA, attrB) {
    const value = element.getAttribute(attrA);
    element.setAttribute(attrA, element.getAttribute(attrB));
    element.setAttribute(attrB, value);
}

/**
 * Invia una richiesta di salvataggio dei dati al server, stampa il messaggio di risposta in console e mostra un dialog in caso di errore.
 * 
 * @async
 * @param {Object} dataset - L'oggetto dataset da salvare.
 * @param {string} url - L'url a cui inviare la richiesta di salvataggio.
 * @param {boolean} [errorShowModal] - Indica se mostrare o meno il dialog in caso di errore.
 * 
 * @returns {Promise<boolean>} r - Indica se la richiesta è andata a buon fine.
 */
async function sendData (dataset, url, errorShowModal = true) {
    const payload = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataset)
    }

    let r = true;
    let message = "Saving log: ";

    try {
        const response = await fetch(url, payload);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        } else {
            const result = await response.json();
            message += result.message;
        }
    } catch (error) {
        if (errorShowModal) {
            const dialog = document.querySelector("dialog");
            dialog.showModal();
        }
        r = false;
        message += error.message;
    }
    
    console.log(message);
    return r;
}

/// SECTION SVG PATHS ///

/**
 * @module utils.svgPaths
 * @description Funzioni per la creazione di path SVG.
 */

/**
 * Crea un path per un anello circolare.
 * 
 * @param {number} cx - Coordinata X del centro dell'anello.
 * @param {number} cy - Coordinata Y del centro dell'anello.
 * @param {number} rInner - Raggio interno dell'anello.
 * @param {number} rOuter - Raggio esterno dell'anello.
 * 
 * @returns {string} path - Il path dell'anello.
 */
function areaRingPath (cx, cy, rInner, rOuter) {
    return `M ${cx} ${cy-rOuter}
        A ${rOuter} ${rOuter} 0 1 0 ${cx} ${cy+rOuter}
        A ${rOuter} ${rOuter} 0 1 0 ${cx} ${cy-rOuter}
        Z
        M ${cx} ${cy-rInner}
        A ${rInner} ${rInner} 0 1 1 ${cx} ${cy+rInner}
        A ${rInner} ${rInner} 0 1 1 ${cx} ${cy-rInner}
        Z`;
}

/**
 * Realizza un path a forma di pin.
 * 
 * @param {number} x - Coordinata X del punto di inizio del path.
 * @param {number} y - Coordinata Y del punto di inizio del path.
 * @param {number} r - Il raggio dell'arco del pin.
 * 
 * @returns {string} path - Il path del pin.
 */
function pinCurrentPath (x, y, r) {
    const c = r / 2;
    const p = r + (r / 2)

    return `M ${x+r} ${y-p}
        c 0 ${c} ${-r} ${p} ${-r} ${p}
        s ${-r} ${-r} ${-r} ${-p}
        a ${r} ${r} 0 0 1 ${r * 2} 0
        z`
}

/**
 * Realizza un path a forma di cerchio.
 * 
 * @param {number} cx - Coordinata X del centro del cerchio.
 * @param {number} cy - Coordinata Y del centro del cerchio.
 * @param {number} r - Raggio del cerchio.
 * 
 * @returns {string} path - Il path del cerchio.
 */
function pinP0Path (cx, cy, r) {
    return `M ${cx} ${cy-r}
        A ${r} ${r} 0 1 0 ${cx} ${cy+r}
        A ${r} ${r} 0 1 0 ${cx} ${cy-r}
        Z`;
}

/**
 * Realizza un path a forma di triangolo.
 * 
 * @param {number} cx - Coordinata X del centro del triangolo.
 * @param {number} cy - Coordinata Y del centro del triangolo.
 * @param {number} r - Raggio del triangolo.
 * 
 * @returns {string} path - Il path del triangolo.
 */
function pinP1Path (cx, cy, r) {
    return `M ${cx} ${cy-r}
        L ${cx+r},${cy+r}
        L ${cx-r},${cy+r}
        Z`;
}

/**
 * Realizza un path a forma di rombo.
 * 
 * @param {number} cx - Coordinata X del centro del rombo.
 * @param {number} cy - Coordinata Y del centro del rombo.
 * @param {number} r - Raggio del rombo.
 * 
 * @returns {string} path - Il path del rombo.
 */
function pinP2Path (cx, cy, r) {
    return `M ${cx} ${cy-r}
        L ${cx+r},${cy}
        L ${cx},${cy+r}
        L ${cx-r},${cy}
        Z`;
}

/**
 * Realizza un path a forma di tooltip.
 * 
 * @param {number} width - La larghezza del tooltip.
 * @param {number} height - L'altezza del tooltip.
 * @param {number} angleRadius - Il raggio dell'angolo del tooltip.
 * @param {number} padding - Il padding del tooltip.
 * @param {number} pinOffset - L'offset del pin del tooltip.
 * 
 * @returns {string} path - Il path del tooltip.
 */
function tooltipPathTop (width, height, angleRadius, padding, pinOffset) {
    width = width + (padding * 2);
    height = height + pinOffset + (padding * 2);

    return `M 0 0
        L ${-pinOffset},${-pinOffset} 
        H ${(-width / 2) + angleRadius}
        Q ${(-width / 2)},${-pinOffset} ${-width / 2},${-pinOffset - angleRadius}  
        V ${-height + angleRadius}   
        Q ${(-width / 2)},${-height} ${(-width / 2) + angleRadius},${-height}
        H ${(width / 2) - angleRadius}
        Q ${(width / 2)},${-height} ${(width / 2)},${-height + angleRadius}
        V ${-pinOffset - angleRadius}
        Q ${(width / 2)},${-pinOffset} ${(width / 2) - angleRadius},${-pinOffset}
        H ${pinOffset} 
        L 0,0 z`;
}

/// SECTION INITMAPSVG FUNCTIONS ///

/**
 * @module utils.init.MapSVG
 * @description Funzioni per l'inizializzazione della mappa SVG.
 */

/**
 * Crea e aggiunge uno stile alla mappa.
 * 
 * @param {SVGElement} svg - L'elemento SVG a cui aggiungere lo stile.
 */
function addMapStyle (svg) {
    let style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.setAttribute("type", "text/css");
    style.textContent = svgStyleString;
    svg.appendChild(style);
}

/**
 * Crea un background monocromatico per la mappa
 * 
 * @param {SVGGElement} svgGroup - Il gruppo a cui aggiungere l'elemento grafico.
 * @param {number} width - La larghezza del background.
 * @param {number} height - L'altezza del background.
 * @param {string} bgColor - Un colore espresso in forma esadecimale.
 * 
 * @returns {SVGRectElement} background - L'elemento grafico.
 */
function addBackground (svgGroup, width, height, bgColor){
    let background = document.createElementNS("http://www.w3.org/2000/svg", "rect");

    background.setAttribute("id", "background");
    background.setAttribute("width", width);
    background.setAttribute("height", height);
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("fill", bgColor);

    svgGroup.appendChild(background);

    return background;
}

/**
 * Aggiunge un elemento grafico per indicare l'area dei panos visibili dal pano corrente.
 * 
 * @param {SVGGElement} svgGroup - Il gruppo a cui aggiungere l'elemento grafico.
 * @param {Array.<number>} translation - Le coordinate di traslazione dell'elemento grafico.
 * @param {VisibilityRange} visibilityRange - L'oggetto che contiene i valori dei range di visibilità.
 * 
 * @returns {SVGGElement} areaContainer - L'elemento grafico.
 */
function addVisibilityArea (svgGroup, translation, visibilityRange) {
    const areaContainer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    areaContainer.setAttribute("id", "visibility_area");
    areaContainer.setAttribute("transform", `translate(${translation[0]}, ${translation[1]}) scale(1, -1)`);
    svgGroup.appendChild(areaContainer);

    const areaP0 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    areaP0.setAttribute("cx", 0);
    areaP0.setAttribute("cy", 0);
    areaP0.setAttribute("r", visibilityRange.P0); 
    areaP0.setAttribute("class", `visibility_area`);
    areaP0.setAttribute("data-priority", 0);
    areaContainer.appendChild(areaP0);
    
    const areaP1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    areaP1.setAttribute("d", areaRingPath(0, 0, visibilityRange.P0, visibilityRange.P1));
    areaP1.setAttribute("class", `visibility_area`);
    areaP1.setAttribute("data-priority", 1);
    areaContainer.appendChild(areaP1);

    const areaP2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    areaP2.setAttribute("d", areaRingPath(0, 0, visibilityRange.P1, visibilityRange.P2));
    areaP2.setAttribute("class", `visibility_area`);
    areaP2.setAttribute("data-priority", 2);
    areaContainer.appendChild(areaP2);

    return areaContainer;
}

/**
 * Aggiorna la posizione dell'elemento grafico dell'area di visibilità spostandone il centro in corrispondenza del pano corrente.
 * 
 * @param {SVGGElement} areaContainer - L'elemento grafico dell'area di visibilità.
 * @param {Array.<number>} areaTranslation - Le coordinate di traslazione dell'elemento grafico.
 * @param {Array.<number>} currentPanoTranslation - Le coordinate di traslazione del pano corrente.
 */
function moveVisibilityArea (areaContainer, areaTranslation, currentPanoTranslation) {
    svgMatrix.getTransformTranslation(areaContainer).setTranslate(areaTranslation.x+currentPanoTranslation[0], areaTranslation.y-currentPanoTranslation[1]);
}

/**
 * Crea un marker e lo aggiunge al gruppo dei marker.
 * 
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 * @param {number} panoIndex - L'indice del pano a cui è associato il marker all'interno del set corrente.
 * 
 * @returns {SVGGElement} pinContainer - Il marker.
 */
function addMarker (minimap, panoIndex) {
    const pinContainer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    pinContainer.setAttribute("transform", `translate(${minimap.currentSet.panos[panoIndex].translation[0]}, ${minimap.currentSet.panos[panoIndex].translation[1]}) scale(1, -1)`);

    createMarkerPin(pinContainer, panoIndex, minimap);

    minimap.markers.DOMElement.appendChild(pinContainer);

    return pinContainer;
}

/**
 * Crea l'elemnto grafico del marker in base alla tipologia/priorità e associa gli handler per gli eventi.
 * 
 * @param {SVGGElement} pinContainer - Il gruppo a cui aggiungere il marker.
 * @param {number} panoIndex - L'indice del pano a cui è associato il marker all'interno del set corrente.
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */
function createMarkerPin (pinContainer, panoIndex, minimap) {

    const pin = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pin.setAttribute("transform", "rotate(0) scale(1, 1)");

    const pano = minimap.currentSet.panos[panoIndex];

    if (pano.id === minimap.currentPano.id) {
        pin.setAttribute("class", `pin current`);
        pin.setAttribute("d", pinCurrentPath (0, 0, minimap.markers.markerRadius*1.5));
    } else {
        const className = generateMarkerClassName(minimap.getPanoVisibility(pano.id), pano.priority);

        pin.setAttribute("class", `pin ${className}`);

        switch (pano.priority) {
            case 0:
                pin.setAttribute("d", pinP0Path(0, 0, minimap.markers.markerRadius));
                break;
            case 1:
                pin.setAttribute("d", pinP1Path(0, 0, minimap.markers.markerRadius));
                break;
            case 2:
                pin.setAttribute("d", pinP2Path(0, 0, minimap.markers.markerRadius));
                break;
            default:
                break;
        }

        pin.addEventListener("mouseenter", (e) => { markerHover(e, panoIndex, minimap.tooltips); });
        pin.addEventListener("mouseleave", (e) => { markerHover(e, panoIndex, minimap.tooltips); });
        pin.addEventListener("click", (e) => { markerClick(e, panoIndex, minimap) });
    }

    pinContainer.appendChild(pin);
}

/**
 * Modifica il tipo di pin del marker da corrente a normale e viceversa.
 * 
 * @param {number} panoIndex - L'indice del pano a cui è associato il marker all'interno del set corrente.
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */
function changePinType (panoIndex, minimap) {
    const marker = minimap.getMarkerDOMElement(panoIndex);

    // Remove current pin
    marker.replaceChildren();

    // Create new pin
    createMarkerPin(marker, panoIndex, minimap)
}

/**
 * Aggiorna le classi dei marker (escluso quello associato al pano corrente) in base alla visibilità e priorità dei panos.
 * 
 * @param {Array.<SVGGElement>} markers - L'array dei marker.
 * @param {number} currentPanoId - L'id del pano corrente.
 * @param {Object.<string, boolean>} panosVisibility - Oggetto che contiene la visibilità dei panos rispetto al pano corrente.
 * @param {Array} panos - L'array dei panos del set corrente.
 */
function updateMarkers (markers, currentPanoId, panosVisibility, panos) {
    for (const [markerIndex, marker] of markers.entries()) {
            
        if (panos[markerIndex].id !== currentPanoId) {

            const className = generateMarkerClassName(panosVisibility[panos[markerIndex].id], panos[markerIndex].priority);
            
            marker.querySelector("path").setAttribute("class", `pin ${className}`);
        }
    }
}

/**
 * Crea un tooltip e lo aggiunge al gruppo dei tooltip.
 * 
 * @param {PanosElementsTooltips} tooltips - L'oggetto che contiene i dati relativi ai tooltip.
 * @param {Array.<number>} translation - Le coordinate di traslazione dell'elemento grafico.
 * @param {string} label - L'etichetta del tooltip.
 * 
 * @returns {SVGGElement} ttContainer - Il tooltip.
 */
function addToolTip (tooltips, translation, label) {
    const ttContainer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    ttContainer.setAttribute("transform", `translate(${translation[0]}, ${-translation[1]}) scale(1, 1)`);
    ttContainer.setAttribute("class", "tooltip invisible");

    const ttText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const ttPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    
    ttContainer.appendChild(ttPath);
    ttContainer.appendChild(ttText);
    tooltips.DOMElement.appendChild(ttContainer);

    ttText.textContent = label;
    const textBB = ttText.getBBox();


    let pathString;
    let textX = 0;
    let textY = 0;

    switch (tooltips.placement) {
        case 'T':
            textX = 0;
            textY = -(tooltips.pinOffset + ((textBB.height + (tooltips.padding * 2))/2) + tooltips.pinDistance);
            pathString = tooltipPathTop(textBB.width, textBB.height, tooltips.angleRadius, tooltips.padding, tooltips.pinOffset);
            break;
        default:
            break;
    }

    ttPath.setAttribute("d", pathString);
    ttPath.setAttribute("fill", "#040505");
    
    ttPath.setAttribute("transform", `translate(0, ${-tooltips.pinDistance})`);
    ttText.setAttribute("x", textX);
    ttText.setAttribute("y", textY);

    return ttContainer;
}

/// SECTION MARKERS EVENT HANDLERS ///

/**
 * @module utils.EventHandlers.markers
 * @description Funzioni per la gestione degli eventi sui marker.
 */

/**
 * Gestisce l'evento di hover del marker.
 * Scala temporaneamente il marker e mostra un tooltip con l'id del pano.
 * 
 * @param {Event} e - L'oggetto evento associato all'azione che ha innescato la chiamata alla funzione.
 * @param {number} panoIndex - L'indice del pano a cui è associato il marker all'interno del set corrente.
 * @param {PanosElementsTooltips} tooltips - L'oggetto che contiene i dati relativi ai tooltip.
 */
function markerHover (e, panoIndex, tooltips) {

    // Controlla che non sia già attiva la modalità di visualizzazione dei tooltips
    if (!tooltips.showAll) {
        // Mostra/Nascondi il tooltip
        const tooltip = tooltips.DOMElements[panoIndex];
        tooltip.classList.toggle("invisible");
    } else {
        for (const tooltip of tooltips.DOMElements) {
            tooltip.classList.toggle("dimmed");
        }
        tooltips.DOMElements[panoIndex].classList.toggle("dimmed");
        tooltips.DOMElements[panoIndex].classList.toggle("hover");
    }

    // Resa visiva dell'interazione con il marker modificando il pin
    e.target.classList.toggle("hover");
    switch (e.type) {
        case "mouseenter":
            svgMatrix.getTransformScale(e.target).setScale(1.5, 1.5);
            break;
        case "mouseleave":
            svgMatrix.getTransformScale(e.target).setScale(1, 1);
            break;
    }
}

/**
 * Gestisce l'evento di click sul marker.
 * L'operazione viene scelta in base alla modalità di editing attiva.
 * 
 * @param {Event} e - L'oggetto evento associato all'azione che ha innescato la chiamata alla funzione.
 * @param {number} panoIndex - L'indice del pano a cui è associato il marker all'interno del set corrente.
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */
function markerClick (e, panoIndex, minimap) {

    const panoID = minimap.currentSet.panos[panoIndex].id;

    switch (minimap.editorMode) {
        case 1:
            minimap.togglePanoVisibility(panoID);

            const className = generateMarkerClassName(minimap.getPanoVisibility(panoID), minimap.currentSet.panos[panoIndex].priority);

            e.target.setAttribute("class", `pin ${className} hover`);

            minimap.saveDataset();

            break;
        default:
            
            // Poichè il pin del marker corrente verra eliminato per essere ridisegnato come marker normale (non corrente) e poichè si sta interagendo nella minimappa (quindi era stato emesso un evento mouseenter sul pin corrente), emette un evento mouseleave che altrimenti non verrebbe emesso
            minimap.markers.DOMElements[panoIndex].querySelector("path").dispatchEvent(new Event("mouseleave"));

            minimap.changePano(panoIndex, true);

            break;
    }
}

/// SECTION INITMAPCONTROLS FUNCTIONS ///

/**
 * @module utils.init.MapControls
 * @description Funzioni per l'inizializzazione dei controlli della mappa.
 */

/**
 * Crea un pulsante a partire da un oggetto che lo definisce e lo aggiunge al container fornito.
 * 
 * @param {HTMLElement} container - Container che raggruppa controlli.
 * @param {Object} button - Oggetto che contiene i dati necessari alla creazione del pulsante.
 */
function addControlButton (container, button) {
    const btn = document.createElement("button");
    btn.classList.add("map_control_btn");
    btn.setAttribute("title", button.title);
    btn.setAttribute("titleAlt", button.titleAlt);

    if (button.fun) {
        button.params ?
        btn.addEventListener("click", (e) => button.eventParam ? button.fun(e, ...button.params) : button.fun(...button.params)) :
        btn.addEventListener("click", (e) => button.eventParam ? button.fun(e) : button.fun());
    }

    btn.classList.add(button.className);
    container.appendChild(btn);
}
  
/**
 * Crea e aggiunge un separatore (barra verticale) al container fornito.
 * 
 * @param {HTMLElement} container - Container che raggruppa controlli.
 */
function addControlSeparator (container) {
    const separator = document.createElement("hr");
    separator.classList.add("controls_separator");
    container.appendChild(separator);
}

/// SECTION MAP SVG EVENT HANDLERS ///

/**
 * @module utils.EventHandlers.mapSVG
 * @description Funzioni per la gestione degli eventi sulla mappa SVG.
 */

/**
 * Gestisce l'evento di interazione con la rotella del mouse quando il mouse è sopra la mappa.
 * 
 * @param {Event} e - L'oggetto evento associato all'azione che ha innescato la chiamata alla funzione.
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */
function mapSVGWheelZoom (e, minimap) {
    e.preventDefault();
  
    let point = new DOMPoint(e.clientX, e.clientY);
  
    const delta = e.deltaY || e.deltaX;
    const scaleStep = Math.abs(delta) < 50
        ? 0.02  // touchpad pitch
        : 0.02; // mouse wheel  
    const scaleDelta = delta < 0 ? 1-scaleStep : 1+scaleStep;
  
    resizeMap(minimap, scaleDelta, scaleDelta, point);
  }

/**
 * Ridimensiona la mappa e i marker.
 * Il risultato sarà una mappa "allargata" in modo tale che il punto in cui è stato effettuato lo zoom rimanga fisso e i marker mantengano la dimensione originale.
 * 
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 * @param {number} sX - La quantità di ridimensionamento lungo l'asse X.
 * @param {number} sY - La quantità di ridimensionamento lungo l'asse Y.
 * @param {DOMPoint} point - Il punto in cui centrare la ridimensione.
 */
function resizeMap(minimap, sX, sY, point) {

    const mapScale = minimap.svgScaleValues;

    if (mapScale.x*sX <= 1 && mapScale.y*sY <= 1 && mapScale.x*sX >= minimap.svgScaleLimit.x && mapScale.y*sY >= minimap.svgScaleLimit.y) {
  
        let translation = new DOMPoint();
        const prevCoord = minimap.toSVGCoordSystem(point);

        // Scale the map
        minimap.svgScale(sX, sY);

        const currentCoord = minimap.toSVGCoordSystem(point);

        translation.x = (prevCoord.x - currentCoord.x);
        translation.y = (prevCoord.y - currentCoord.y);

        translationInBounds(minimap, translation);

        minimap.svgTranslate(translation.x, translation.y);

        // Scale markers
        for (const marker of minimap.markers.DOMElements) {
            svgMatrix.transformScale(marker, sX, sY);
        }

        // Scale tooltips
        for (const tooltip of minimap.tooltips.DOMElements) {
            svgMatrix.transformScale(tooltip, sX, sY);
        }

        // Aggiorna la visibilità dei tooltip
        if (minimap.tooltips.showAll) {
            if ((sX < 1 && mapScale.x <= minimap.tooltips.showListLastThreshold-minimap.tooltips.showListScaleStep) ||
                (sX > 1 && mapScale.x >= minimap.tooltips.showListLastThreshold)) {
                    updateTooltipsVisibility(minimap);
            }
        }
    }
}

/**
 * Gestisce l'evento di click con drag&drop sullo sfondo della mappa al fine di effettuare una traslazione della mappa.
 * 
 * @param {Event} e - L'oggetto evento associato all'azione che ha innescato la chiamata alla funzione.
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */

function mapSVGClickDrag (e, minimap) {
    e.preventDefault();
  
    document.body.classList.toggle("dragging");
  
    let prevPT = new DOMPoint(e.clientX, e.clientY);
    let currentPT = new DOMPoint();
    let translation = new DOMPoint();
  
    prevPT = minimap.toSVGCoordSystem(prevPT);
  
    const svgMousemove = e => {
        e.preventDefault();
  
        currentPT.x = e.clientX;
        currentPT.y = e.clientY;
        currentPT = minimap.toSVGCoordSystem(currentPT);
  
        translation.x = prevPT.x - currentPT.x;
        translation.y = prevPT.y - currentPT.y;
  
        translationInBounds(minimap, translation);
        minimap.svgTranslate(translation.x, translation.y);
  
        prevPT.x = (translation.x === 0) ? currentPT.x : prevPT.x;
        prevPT.y = (translation.y === 0) ? currentPT.y : prevPT.y;
    };
  
  
    const svgMouseup = e => {
        e.preventDefault();
  
        document.body.classList.toggle("dragging");
        document.removeEventListener('mousemove', svgMousemove);
        document.removeEventListener('mouseup', svgMouseup);
    };
  
    document.addEventListener('mousemove', svgMousemove);
    document.addEventListener('mouseup', svgMouseup);
}

/**
 * Modifica i valori del vettore di traslazione passato come parametro in modo tale che la mappa rimanga all'interno dei limiti di visualizzazione.
 * 
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 * @param {DOMPoint} translation - Il vettore di traslazione.
 */
function translationInBounds (minimap, translation) {
  
    const yMin = minimap.svgOriginalViewBox.y;
    const yMax = minimap.svgOriginalViewBox.height-(minimap.svgViewPortSize.height*minimap.svgScaleValues.y);
  
    const xMin = minimap.svgOriginalViewBox.x;
    const xMax = minimap.svgOriginalViewBox.width-(minimap.svgViewPortSize.width*minimap.svgScaleValues.x);
  
    const yTranslated = minimap.svgViewBoxBaseVal.y + translation.y;
    const xTranslated = minimap.svgViewBoxBaseVal.x + translation.x;
    
    const inBounds = {
        t: yTranslated >= yMin,
        b: yTranslated <= yMax,
        l: xTranslated >= xMin,
        r: xTranslated <= xMax
    };

    if (!inBounds.t) {
        translation.y = translation.y-(yTranslated-yMin);
    }

    if (!inBounds.l) {
        translation.x = translation.x-(xTranslated-xMin);
    }

    if (!inBounds.b) {
        translation.y = translation.y-(yTranslated-yMax);
    }

    if (!inBounds.r) {
        translation.x = translation.x-(xTranslated-xMax);
    }
}

/// SECTION CONTROLS BAR EVENT HANDLERS ///

/**
 * @module utils.EventHandlers.controlsBar
 * @description Funzioni per la gestione degli eventi sulla barra dei controlli.
 */

/**
 * Realizza il passaggio della mappa da normale a ingrandita e viceversa.
 *
 * @param {Event} e - L'oggetto evento associato all'azione che ha innescato la chiamata alla funzione.
 */
function maximize (e) {
    let container = document.getElementById("map_container");
    container.classList.toggle("map_container_maximize");

    // Change icon
    e.target.classList.toggle("control_bar_minimize");
    attributeSwitch(e.target, "title", "titleAlt");
}

/**
 * Attiva/disattiva la modalità di gestione della visibilità dei panos visibili dal pano corrente.
 * 
 * @param {Event} e - L'oggetto evento associato all'azione che ha innescato la chiamata alla funzione.
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */
function activeVisibilityManageMode (e, minimap) {
    e.target.toggleAttribute("active");
    minimap.toggleEditorMode(1);
}

/**
 * Attiva/disattiva la visualizzazione dei tooltip dei marker.
 * 
 * @param {Event} e - L'oggetto evento associato all'azione che ha innescato la chiamata alla funzione.
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */
function toggleTooltips (e, minimap) {
    e.target.toggleAttribute("active");

    // Se non è attiva la modalità di visualizzazione dei tooltip, aggiorna la showList
    if (!minimap.tooltips.showAll) {
        minimap.updateShowList();
    }

    // Aggiorna lo stato della modalità di visualizzazione dei tooltip
    minimap.toggleShowAllTooltips();

    // Mostra/Nasconde i tooltip
    toggleTooltipsVisibility (minimap.tooltips.showList, minimap.tooltips.DOMElements);
}

/**
 * Mostra/nasconde i tooltip dei marker in base alla showList.
 * 
 * @param {Array.<number>} showList - L'array degli indici dei tooltip da mostrare/nascondere.
 * @param {Array.<SVGElement>} tooltips - L'array dei tooltip.
 */
function toggleTooltipsVisibility (showList, tooltips) {
    for (const index of showList) {
        tooltips[index].classList.toggle("invisible");
    }
}

/**
 * Aggiorna la visibilità dei tooltip quando la modalità di visualizzazione è attiva.
 * 
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */
function updateTooltipsVisibility (minimap) {
    if (minimap.tooltips.showAll) {
        // se i tooltip della showList sono visibili, li nasconde
        for (const index of minimap.tooltips.showList) {
            if (!minimap.tooltips.DOMElements[index].classList.contains("invisible")) {
                minimap.tooltips.DOMElements[index].classList.add("invisible");
            }
        }

        // aggiorna la showList
        minimap.updateShowList();
        
        // mostra i tooltip della showList
        toggleTooltipsVisibility (minimap.tooltips.showList, minimap.tooltips.DOMElements);
    }
}

/**
 * Riporta la mappa e i marker allo stato iniziale in termini di scalatura e traslazione.
 * 
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */
function zoomReset (minimap) {
    
    // Scale markers
    for (const marker of minimap.markers.DOMElements) {
        const markerScale = svgMatrix.getTransformScale(marker);
        markerScale.setScale(1, -1);
    }
    
    // Scale tooltips
    for (const [tooltipIndex, tooltip] of minimap.tooltips.DOMElements.entries()) {
        const tooltipScale = svgMatrix.getTransformScale(tooltip);
        tooltipScale.setScale(1, 1);
    }

    // Scale map
    minimap.svgTransformReset();

    // Reset tooltips visibility
    updateTooltipsVisibility (minimap);

}

/**
 * Esegue uno zoom lungo entrambi gli assi X e Y apllicato nel centro del container della mappa.
 * 
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 * @param {number} step - La quantità di zoom da eseguire.
 */
function zoom (minimap, step) {
    resizeMap(minimap, step, step, minimap.svgContainerCenter);
}

/**
 * Realizza il passaggio della mappa da ridotta ad icona a visibile e viceversa.
 */
function minimizeMap () {
    let minimap = document.getElementById("minimap_container");
    for (const child of minimap.children) {
        child.classList.toggle("hidden");
    }
}

/// SECTION OTHER EVENT HANDLERS ///

/**
 * @module utils.EventHandlers.other
 * @description Funzioni per la gestione degli altri eventi.
 */

/**
 * Gestisce l'evento di click sull'icona di apertura della mappa.
 */
function openIconClick () {
    let minimapContainer = document.getElementById("minimap_container");

    for (const child of minimapContainer.children) {
        child.classList.toggle("hidden");
    }
}

/**
 * Aggiorna la posizione e dimensione del container della mappa SVG.
 * 
 * @param {MiniMap} minimap - L'oggetto MiniMap a cui è associata la mappa.
 */
function updateContainer (minimap) {
    minimap.updateSVGContainer();

    let translation = new DOMPoint(0, 0);
    translationInBounds(minimap, translation);
    
    minimap.svgTranslate(translation.x, translation.y);
}

export {
    addMapStyle,
    addBackground,
    addVisibilityArea,
    moveVisibilityArea,
    addMarker,
    changePinType,
    updateMarkers,
    addToolTip,
    addControlButton,
    addControlSeparator,
    openIconClick,
    mapSVGWheelZoom,
    mapSVGClickDrag,
    minimizeMap,
    maximize,
    activeVisibilityManageMode,
    toggleTooltips,
    zoomReset,
    zoom,
    updateContainer,
    sendData,
    translationInBounds,
    updateTooltipsVisibility,
    toggleTooltipsVisibility,
};