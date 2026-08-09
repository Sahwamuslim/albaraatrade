const firebaseConfig = {
    apiKey: "AIzaSyDcVwF4D_n2rrm-26QH_RD3U_4RR0MTD5E",
    authDomain: "albaraa-t.firebaseapp.com",
    projectId: "albaraa-t",
    storageBucket: "albaraa-t.firebasestorage.app",
    messagingSenderId: "375152909438",
    appId: "1:375152909438:web:1d72af6c2d31e4a11d8c2f"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();