

const initGamepad = () => {

    let keyboardChosen = false;

    $(document).on("keypress", () => {
        keyboardChosen = true;
    });

    const checkGP = window.setInterval(() => {
        if(navigator.getGamepads()[0] || keyboardChosen) {
            console.log("Control available")
            startGraphics();
            window.clearInterval(checkGP);
        }
    }, 500); 
}

initGamepad();