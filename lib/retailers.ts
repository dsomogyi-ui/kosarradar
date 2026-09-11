export const RETAILERS = [
 {id:'e9cc63fd-52e0-4c1e-ba8d-d135d7285c63',name:'Auchan'},
 {id:'792ea257-0af9-4588-ada7-81bd96c96400',name:'Tesco'},
 {id:'f95031d8-84a5-4edf-b4fa-18b2cbae2ea1',name:'Lidl'},
 {id:'55b678e0-4e02-49d7-86da-ba6fba862a7e',name:'Aldi'},
] as const;
export const allowedChain = (id: unknown) => RETAILERS.some(c => c.id === id);
