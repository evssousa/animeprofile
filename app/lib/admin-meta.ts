// `meta` das páginas do painel. Em React Router o `meta` do filho substitui o do pai, então toda tela do painel que
// exporta `meta` usa este ajudante para nunca perder o `noindex`.
export const adminMeta = (titulo: string) => [{ title: `${titulo} | Painel` }, { name: "robots", content: "noindex, nofollow" }];
