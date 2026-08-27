import { getSessionToken } from "./accountApi";

const API_BASE = "https://myanmarsportstalk.com/api";
async function decode(response){const text=await response.text();if(!text)return null;try{return JSON.parse(text);}catch(_){return{message:text};}}
async function api(path,{method="GET",body}={}){const token=await getSessionToken();const response=await fetch(`${API_BASE}${path}`,{method,credentials:"include",headers:{Accept:"application/json",...(body!==undefined?{"Content-Type":"application/json"}:{}),...(token?{Authorization:`Bearer ${token}`,"x-mst-session":token}:{})},body:body!==undefined?JSON.stringify(body):undefined});const payload=await decode(response);if(!response.ok){const error=new Error(payload?.error||payload?.message||`MST Community API ${response.status}`);error.status=response.status;throw error;}return payload?.data??payload;}
export const getMatchChat=(matchId,{limit=80}={})=>api(`/match-chat?matchId=${encodeURIComponent(String(matchId))}&limit=${encodeURIComponent(String(limit))}`);
export const postMatchChat=(matchId,body)=>api("/match-chat",{method:"POST",body:{matchId:String(matchId),body:String(body||"")}});
export const reportMatchChat=(messageId,reason="inappropriate")=>api("/match-chat/report",{method:"POST",body:{messageId:String(messageId),reason}});
