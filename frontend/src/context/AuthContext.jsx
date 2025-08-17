import React, { createContext, useState, useContext, useEffect } from 'react'; import jwt_decode from 'jwt-decode';
const AuthContext = createContext(null);
export const AuthProvider=({children})=>{const [u,setU]=useState(null);const [t,setT]=useState(localStorage.getItem('token'));const [l,setL]=useState(true);useEffect(()=>{try{if(t){const d=jwt_decode(t);if(d.exp*1000>Date.now()){setU({id:d.id,username:d.username});}else{logout();}}}catch(e){logout();}finally{setL(false);}},[t]);const login=(nT)=>{localStorage.setItem('token',nT);setT(nT);};const logout=()=>{localStorage.removeItem('token');setT(null);setU(null);};return(<AuthContext.Provider value={{user:u,token:t,login,logout,loading:l}}>{!l && children}</AuthContext.Provider>);};
export const useAuth = () => useContext(AuthContext);
