class Wheel {
    constructor(car, index, longOffset, latOffset) {
        this.parent = car;
        this.index = index;
        this.longOffset = longOffset;
        this.latOffset = latOffset;
    }
    getRay() {
        const longOffset = this.parent.pose.direction.clone().multiplyScalar(this.longOffset);
        const latOffset = this.parent.rightVector().multiplyScalar(this.latOffset);
        const origin = this.parent.pose.position.clone().add(longOffset).add(latOffset).add(this.parent.pose.up);
        const direction = this.parent.pose.up.clone().multiplyScalar(-1);
        return new THREE.Raycaster(origin, direction);
    }
}
