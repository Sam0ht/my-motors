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

    LEFT = 37;
    RIGHT = 39;
    UP = 38;
    DOWN = 40;

    constructor() {
        this.steeringInput = 0;
        this.throttleInput = 0;
        this.brakeInput = 0;
        this.keyState = {};
        $(document).on("keydown", event => this.keyState[event.which] = true);
        $(document).on("keyup", event => this.keyState[event.which] = false);
        
        window.setInterval(() => {
        
            if (this.keyState[this.LEFT]) {  //left
                this.steeringInput = -1;                
            } else if (this.keyState[this.RIGHT]) { // right
                this.steeringInput = 1;
            } else {
                this.steeringInput = 0;
            }

            if (this.keyState[this.UP]) { // up 
                this.throttleInput = 1;
            } else {
                this.throttleInput = 0;
            }

            if (this.keyState[this.DOWN]) { //down
                this.brakeInput = 1;
            } else {
                this.brakeInput = 0;
            }
          
        }, 50);
    }

    getInputs = () => this
    
}