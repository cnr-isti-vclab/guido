/**
 * @file Funzioni per il recupero e la modifica delle matrici di trasformazione degli elementi SVG.
 */

/**
 * @module svgMatrix
 */

/**
 * Modifica la matrice di traslazione.
 * 
 * @param {SVGElement} element - Elemento da traslare
 * @param {number} transX - La quantità di traslazione lungo l'asse X.
 * @param {number} transY - La quantità di traslazione lungo l'asse Y.
 */
function transformTranslate (element, transX, transY) {
    let translate = getTransformTranslation(element);

    if (translate) {
        const baseX = translate.matrix.e;
        const baseY = translate.matrix.f;
        
        translate.setTranslate(baseX+transX, baseY+transY);
    }
}

/**
 * Modifica la matrice di scala.
 * 
 * @param {SVGElement} element - Elemento da scalare
 * @param {number} scaleX - La quantità di ridimensionamento lungo l'asse X.
 * @param {number} scaleY - La quantità di ridimensionamento lungo l'asse Y.
 */
function transformScale (element, scaleX, scaleY) {
    let scale = getTransformScale(element);

    if (scale) {
        const baseX = scale.matrix.a;
        const baseY = scale.matrix.d;
        
        scale.setScale(baseX*scaleX, baseY*scaleY);
    }
}

/**
 * Modifica la matrice di rotazione.
 * 
 * @param {SVGElement} element - Elemento da ruotare
 * @param {number} angle - L'angolo di rotazione.
 * @param {number} [x] - Coordinata X del punto di rotazione.
 * @param {number} [y] - Coordinata Y del punto di rotazione.
 */
function transformRotate (element, angle, x=0, y=0) {
    let rotate = getTransformRotation(element);

    if (rotate) {
        const baseAngle = rotate.angle;

        rotate.setRotate(baseAngle+angle, x, y);
    }
}

/**
 * Recupera la matrice di traslazione di un elemento SVG.
 * 
 * @param {SVGElement} element - Elemento da cui recuperare la matrice di traslazione
 * @returns {SVGTransform}
 */
function getTransformTranslation (element) {
    const transformList = element.transform.baseVal;

    for (const t of transformList) {
        if (t.type === SVGTransform.SVG_TRANSFORM_TRANSLATE) {
            return t;
        }
    }

    return null;
}

/**
 * Recupera la matrice di scala di un elemento SVG.
 * 
 * @param {SVGElement} element - Elemento da cui recuperare la matrice di scala
 * @returns {SVGTransform}
 */
function getTransformScale (element) {
    const transformList = element.transform.baseVal;

    for (const t of transformList) {
        if (t.type === SVGTransform.SVG_TRANSFORM_SCALE) {
            return t;
        }
    }

    return null;
}

/**
 * Recupera la matrice di rotazione di un elemento SVG.
 * 
 * @param {SVGElement} element - Elemento da cui recuperare la matrice di rotazione
 * @returns {SVGTransform}
 */
function getTransformRotation (element) {
    const transformList = element.transform.baseVal;

    for (const t of transformList) {
        if (t.type === SVGTransform.SVG_TRANSFORM_ROTATE) {
            return t;
        }
    }

    return null;
}

export {
    transformTranslate,
    transformScale,
    transformRotate,
    getTransformTranslation,
    getTransformScale,
    getTransformRotation
};