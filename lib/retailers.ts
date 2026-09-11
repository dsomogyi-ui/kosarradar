export const RETAILERS = [
 {id:'e9cc63fd-52e0-4c1e-ba8d-d135d7285c63',name:'Auchan'},
 {id:'792ea257-0af9-4588-ada7-81bd96c96400',name:'Tesco'},
] as const;
export const allowedChain = (id: unknown) => RETAILERS.some(c => c.id === id);
export const allowedFavoriteId = (id: unknown): id is string => typeof id === 'string' && /^(auchan|tesco)-[a-zA-Z0-9_-]+$/.test(id);
