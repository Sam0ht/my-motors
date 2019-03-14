class Gamepad {

    getInputs = () => {
        const gamepad = navigator.getGamepads()[0]
        const steeringInput = this.controlCurve(gamepad.axes[2]);
        const throttleInput = gamepad.buttons[7].value;
        const brakeInput = gamepad.buttons[6].value;
        return { steeringInput, throttleInput, brakeInput }
    }

    controlCurve = (steeringInput) => {
        const absIn = Math.abs(steeringInput);
        const positiveInput = absIn * 0.5 + Math.max(0, absIn - 0.5);
        return positiveInput * Math.sign(steeringInput);
    }
    
}

class Keyboard {

    constructor() {
        this.steeringInput = 0;
        this.throttleInput = 0;
        this.brakeInput = 0;
        $(document).on("keydown", event => {
            if (event.which === 37 && this.steeringInput > -1) {  //left
                if (this.steeringInput > 0) {
                    this.steeringInput = 0;
                }
                this.steeringInput -= 0.01;                
            } else if (event.which === 39 && this.steeringInput < 1) { // right
                if (this.steeringInput < 0) {
                    this.steeringInput = 0;
                }
                this.steeringInput += 0.01;
            } else if (event.which === 38 && this.throttleInput < 1) { // up 
                this.throttleInput += 0.02;
                this.brakeInput = 0;
            } else if (event.which === 40 && this.brakeInput < 1) { //down
                this.throttleInput = 0;
                this.brakeInput += 0.02;
            }
        });
        window.setInterval(() => {
            if (this.steeringInput > 0) {
                this.steeringInput -= 0.001;
            }
            if (this.steeringInput < 0) {
                this.steeringInput += 0.001;
            }
            if (this.throttleInput > 0) {
                this.throttleInput -= 0.001;
            }
            if (this.brakeInput > 0) {
                this.brakeInput -= 0.001;
            }
        }, 100);
    }

    getInputs = () => {
        return this
    }

}