const firstOr = (otherwise) => (list) => list.length > 0 ? list[0] : otherwise;

const scale = (vector, scalar) => vector.clone().multiplyScalar(scalar);

const sum = (...vectors) => vectors.reduce((a, b) => a.clone().add(b));

const cross = (vectorA, vectorB) => vectorA.clone().cross(vectorB);

const dot = (vectorA, vectorB) => vectorA.clone().dot(vectorB);

const rotateByAround = (vector, angle, axis) => vector.clone().applyAxisAngle(axis, angle);

const angleFrom = (v1, v2, aroundAxis) => {
    const angle = v1.angleTo(v2);
    const crossed = cross(v1, v2);
    const polarity = Math.sign(dot(aroundAxis, crossed));
    return angle * polarity; // angleTo is absolute, doesn't include direction (sigh)
}