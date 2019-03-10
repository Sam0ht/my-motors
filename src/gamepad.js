
const pickupGamepad = () => {
    window.gamepad = navigator.getGamepads()[0]
    startGraphics();
}

const initGamepad = () => {

    const checkGP = window.setInterval(() => {
        if(navigator.getGamepads()[0]) {
            console.log("Gamepad available")
            pickupGamepad();
            window.clearInterval(checkGP);
        }
    }, 500); 
}

initGamepad();