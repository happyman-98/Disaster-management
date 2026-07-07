/* ================================================================
   SAHAYOG RESPONSE NETWORK — LOGIN / SIGNUP
   ================================================================
   BACKEND TEAM: everything you need to hook up is in the CONFIG
   block right below. Update BASE_URL and the ENDPOINTS paths to
   match your API, and make sure your responses follow the shapes
   documented next to each fetch call further down this file.
   ================================================================ */


// ================================
// CONFIG — backend team edits this
// ================================

const CONFIG = {

    // Root of your API. Examples:
    //   local dev:  "http://localhost:5000/api"
    //   deployed:   "https://sahayog-api.onrender.com/api"
    BASE_URL: "http://localhost:5000/api",

    ENDPOINTS: {
        LOGIN:   "/auth/login",     // POST  { email, password }
        SIGNUP:  "/auth/signup",    // POST  { name, email, phone, password }
        GUEST:   "/auth/guest"      // POST  {}  (optional — emergency guest access)
    },

    // localStorage keys used to persist the session on this device
    STORAGE_KEYS: {
        TOKEN: "sahayog_token",
        USER:  "sahayog_user"
    },

    // Where to send the user after a successful login/signup.
    // Change this to your actual dashboard route.
    REDIRECT_ON_AUTH: "dashboard.html"

};


/* ----------------------------------------------------------------
   EXPECTED API CONTRACTS

   POST {BASE_URL}{ENDPOINTS.LOGIN}
     body:  { "email": string, "password": string }
     200 →  { "token": string, "user": { "id": string, "name": string, "email": string, "role": string } }
     4xx →  { "message": string }   (shown to the user)

   POST {BASE_URL}{ENDPOINTS.SIGNUP}
     body:  { "name": string, "email": string, "phone": string, "password": string }
     201 →  { "token": string, "user": { "id": string, "name": string, "email": string, "role": string } }
     4xx →  { "message": string }

   POST {BASE_URL}{ENDPOINTS.GUEST}   (optional, for the Emergency button)
     body:  {}
     200 →  { "token": string, "user": { "id": string, "role": "guest" } }

   All authenticated requests after login should send:
     Authorization: Bearer <token>
---------------------------------------------------------------- */


// ================================
// DOM Elements
// ================================

const panelLogin = document.getElementById("panelLogin");
const panelSignup = document.getElementById("panelSignup");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

const loginEmailInput = document.getElementById("loginEmail");
const loginPassInput = document.getElementById("liPass");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

const emergencyBtn = document.getElementById("emergencyBtn");

const suName = document.getElementById("suName");
const suEmail = document.getElementById("suEmail");
const suPhone = document.getElementById("suPhone");
const suPass = document.getElementById("suPass");
const signupError = document.getElementById("signupError");

const signupBtn = signupForm.querySelector("button[type='submit']");


// ================================
// API Helper
// ================================

/**
 * Sends a JSON request to the backend and returns the parsed response.
 * Throws an Error with a user-friendly message on failure, so callers
 * can just try/catch and display err.message.
 */
async function apiRequest(path, method = "POST", body = null){

    const options = {
        method,
        headers: {
            "Content-Type": "application/json"
        }
    };

    // Attach the saved token automatically, if one exists
    const token = getToken();
    if(token){
        options.headers["Authorization"] = `Bearer ${token}`;
    }

    if(body !== null){
        options.body = JSON.stringify(body);
    }

    let response;

    try{
        response = await fetch(CONFIG.BASE_URL + path, options);
    }catch(networkErr){
        throw new Error("Can't reach the server. Check your connection and try again.");
    }

    let data = null;

    try{
        data = await response.json();
    }catch(parseErr){
        // backend returned no body / non-JSON — fine for some responses
        data = null;
    }

    if(!response.ok){
        const message = (data && data.message) || `Request failed (${response.status}).`;
        throw new Error(message);
    }

    return data;

}


// ================================
// Session Storage Helpers
// ================================

function saveSession(token, user){
    localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
}

function getToken(){
    return localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
}

function getUser(){
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
}

function clearSession(){
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
}


// ================================
// Inline error helpers
// ================================

function showError(el, message){
    el.textContent = message;
    el.classList.add("visible");
}

function clearError(el){
    el.textContent = "";
    el.classList.remove("visible");
}


// ================================
// Login / Signup Panel Switching
// ================================

function setActive(mode){

    if(mode === "login"){
        panelLogin.classList.remove("inactive");
        panelSignup.classList.add("inactive");
    }else{
        panelSignup.classList.remove("inactive");
        panelLogin.classList.add("inactive");
    }

}

document.getElementById("goSignup").addEventListener("click", () => {
    setActive("signup");
});

document.getElementById("goLogin").addEventListener("click", () => {
    setActive("login");
});


// ================================
// Emergency / Guest Button
// ================================

emergencyBtn.addEventListener("click", async () => {

    const original = emergencyBtn.innerHTML;

    emergencyBtn.disabled = true;
    emergencyBtn.innerHTML = "<span class='dot'></span> Getting you in...";

    try{

        // If your backend doesn't have a guest endpoint yet, this call
        // will fail — that's fine, we still let the person through
        // locally so the emergency flow never blocks someone in a crisis.
        const data = await apiRequest(CONFIG.ENDPOINTS.GUEST, "POST", {});

        if(data && data.token){
            saveSession(data.token, data.user || { role: "guest" });
        }

    }catch(err){

        console.warn("Guest endpoint unavailable, continuing as local guest:", err.message);

    }

    emergencyBtn.innerHTML = "<span class='dot'></span> Guest access granted — Stay Safe";

    setTimeout(() => {
        emergencyBtn.disabled = false;
        emergencyBtn.innerHTML = original;
        window.location.href = CONFIG.REDIRECT_ON_AUTH;
    }, 1400);

});


// ================================
// Phone Input
// ================================

const iti = window.intlTelInput(suPhone,{

    initialCountry:"auto",

    geoIpLookup:function(callback){

        fetch("https://ipapi.co/json/")
            .then(res=>res.json())
            .then(data=>callback(data.country_code.toLowerCase()))
            .catch(()=>callback("np"));

    },

    preferredCountries:[
        "np",
        "in",
        "us",
        "gb"
    ],

    separateDialCode:true,

    nationalMode:true,

    strictMode:true,

    autoPlaceholder:"aggressive",

    useFullscreenPopup:false,

    fixDropdownWidth:false,

    loadUtils:()=>
        import("https://cdn.jsdelivr.net/npm/intl-tel-input@25.3.0/build/js/utils.js")

});


// ================================
// Login
// ================================

loginForm.addEventListener("submit", async function(e){

    e.preventDefault();

    clearError(loginError);

    const email = loginEmailInput.value.trim();
    const password = loginPassInput.value;

    if(!email || !password){
        showError(loginError, "Please fill in all fields.");
        return;
    }

    const originalText = loginBtn.textContent;
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";

    try{

        const data = await apiRequest(CONFIG.ENDPOINTS.LOGIN, "POST", {
            email,
            password
        });

        // Expecting { token, user } from the backend
        if(!data || !data.token){
            throw new Error("Unexpected response from server.");
        }

        saveSession(data.token, data.user);

        window.location.href = CONFIG.REDIRECT_ON_AUTH;

    }catch(err){

        console.error(err);
        showError(loginError, err.message || "Login failed. Please try again.");

    }finally{

        loginBtn.disabled = false;
        loginBtn.textContent = originalText;

    }

});


// ================================
// Signup
// ================================

signupForm.addEventListener("submit", async function(e){

    e.preventDefault();

    clearError(signupError);

    const name = suName.value.trim();
    const email = suEmail.value.trim();
    const password = suPass.value;

    if(!name || !email || !password){
        showError(signupError, "Please fill in all fields.");
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(!emailRegex.test(email)){
        showError(signupError, "Please enter a valid email address.");
        return;
    }

    if(password.length < 8){
        showError(signupError, "Password must contain at least 8 characters.");
        return;
    }

    if(!iti.isValidNumber()){
        showError(signupError, "Please enter a valid mobile number.");
        suPhone.focus();
        return;
    }

    const phone = iti.getNumber();

    const user = {
        name,
        email,
        phone,
        password
    };

    signupBtn.disabled = true;
    signupBtn.textContent = "Creating Account...";

    try{

        const data = await apiRequest(CONFIG.ENDPOINTS.SIGNUP, "POST", user);

        // Expecting { token, user } from the backend
        if(!data || !data.token){
            throw new Error("Unexpected response from server.");
        }

        saveSession(data.token, data.user);

        signupForm.reset();
        iti.setCountry("np");

        window.location.href = CONFIG.REDIRECT_ON_AUTH;

    }catch(error){

        console.error(error);
        showError(signupError, error.message || "Something went wrong. Please try again.");

    }finally{

        signupBtn.disabled = false;
        signupBtn.textContent = "Create Account";

    }

});


// ================================
// Ambient Sparks
// ================================

const sparkField = document.getElementById("sparkField");

for(let i=0;i<14;i++){

    const s=document.createElement("div");
    s.className="spark";
    s.style.left=(Math.random()*90+3)+"%";
    s.style.bottom=(Math.random()*60)+"%";
    s.style.animationDelay=(Math.random()*5)+"s";
    s.style.animationDuration=(4+Math.random()*3)+"s";
    sparkField.appendChild(s);

}


// ================================
// Ambient Leaves
// ================================

const leafField=document.getElementById("leafField");

for(let i=0;i<10;i++){

    const l=document.createElement("div");
    l.className="leaf";
    l.style.left=(Math.random()*90+3)+"%";
    l.style.bottom=(Math.random()*50)+"%";
    l.style.animationDelay=(Math.random()*6)+"s";
    l.style.animationDuration=(5+Math.random()*3)+"s";
    leafField.appendChild(l);

}


// ================================
// Show / Hide Password
// ================================

document.querySelectorAll(".toggle-password").forEach(icon => {

    icon.addEventListener("click", () => {

        const input = document.getElementById(icon.dataset.target);

        if(input.type === "password"){
            input.type = "text";
            icon.classList.remove("ri-eye-line");
            icon.classList.add("ri-eye-off-line");
        }else{
            input.type = "password";
            icon.classList.remove("ri-eye-off-line");
            icon.classList.add("ri-eye-line");
        }

    });

});