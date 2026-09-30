// Demo catalogs for the seed. Kept apart from seed.ts so the data reads as data.
// The two companies are in different segments, but a few names overlap on purpose
// ("Kit Presente", "Garrafa Térmica", "Kit Viagem") so the chat can demonstrate
// that a question about them only ever answers with the caller's own product.

export type SeedProduct = {
  name: string;
  description: string;
  priceCents: number;
  category: string;
  /** false leaves imageUrl unset, to exercise the web's image fallback. */
  image?: false;
};

export const PET_FELIZ_PRODUCTS: SeedProduct[] = [
  {
    name: "Ração Premium Cães Adultos 15kg",
    description: "Ração super premium para cães adultos de porte médio, com frango e arroz, sem corantes artificiais.",
    priceCents: 18990,
    category: "Rações",
  },
  {
    name: "Ração Gatos Castrados Salmão 3kg",
    description: "Fórmula para gatos castrados com controle de peso e cuidado urinário. Sabor salmão.",
    priceCents: 8990,
    category: "Rações",
  },
  {
    name: "Ração Filhotes Raças Pequenas 1kg",
    description: "Grãos menores e DHA para o desenvolvimento de filhotes de raças pequenas até 12 meses.",
    priceCents: 4290,
    category: "Rações",
  },
  {
    name: "Bifinho de Carne 65g",
    description: "Petisco macio sabor carne para cães de todas as idades. Ideal para adestramento.",
    priceCents: 890,
    category: "Petiscos",
  },
  {
    name: "Sachê Gatos Atum ao Molho 85g",
    description: "Alimento úmido completo para gatos adultos, pedaços de atum ao molho.",
    priceCents: 390,
    category: "Petiscos",
    image: false,
  },
  {
    name: "Bola Mordedor de Borracha",
    description: "Bola de borracha atóxica e resistente, com espaço para petiscos. Tamanho médio.",
    priceCents: 3490,
    category: "Brinquedos",
  },
  {
    name: "Arranhador Torre para Gatos 70cm",
    description: "Torre com sisal natural, duas plataformas e bolinha pendurada.",
    priceCents: 15990,
    category: "Brinquedos",
  },
  {
    name: "Coleira Ajustável Refletiva",
    description: "Coleira de nylon com faixa refletiva para passeios noturnos. Tamanhos P, M e G.",
    priceCents: 3990,
    category: "Acessórios",
  },
  {
    name: "Cama Pet Redonda Antialérgica",
    description: "Cama acolchoada com tecido antialérgico e base antiderrapante. 60cm de diâmetro.",
    priceCents: 12990,
    category: "Acessórios",
  },
  {
    name: "Garrafa Térmica Pet para Passeio 500ml",
    description: "Garrafa com bebedouro acoplado que mantém a água fresca por até 6 horas nos passeios.",
    priceCents: 5990,
    category: "Acessórios",
  },
  {
    name: "Shampoo Neutro Pelos Sensíveis 500ml",
    description: "Shampoo hipoalergênico com pH balanceado para cães e gatos de pele sensível.",
    priceCents: 3290,
    category: "Higiene",
  },
  {
    name: "Tapete Higiênico 30 unidades",
    description: "Tapete com gel superabsorvente e atrativo para cães. 60x60cm.",
    priceCents: 6490,
    category: "Higiene",
    image: false,
  },
  {
    name: "Kit Presente Pet Feliz",
    description: "Caixa presente com bola mordedor, bifinho, lenço personalizado e cartão. Para cães.",
    priceCents: 9990,
    category: "Kits",
  },
  {
    name: "Kit Viagem Pet",
    description: "Bolsa de transporte com bebedouro dobrável, comedouro portátil e tapetes higiênicos.",
    priceCents: 17990,
    category: "Kits",
  },
];

export const VOLT_PRODUCTS: SeedProduct[] = [
  {
    name: "Smartphone Volt X12 128GB",
    description: "Tela AMOLED de 6,5 polegadas, câmera tripla de 50MP, bateria de 5000mAh e 5G.",
    priceCents: 219900,
    category: "Smartphones",
  },
  {
    name: "Smartphone Volt Lite 64GB",
    description: "Tela de 6,1 polegadas, câmera dupla de 13MP e bateria de 4000mAh. Ótimo custo-benefício.",
    priceCents: 99900,
    category: "Smartphones",
  },
  {
    name: "Fone Bluetooth com Cancelamento de Ruído",
    description: "Fone over-ear com cancelamento ativo de ruído e 30 horas de bateria.",
    priceCents: 59900,
    category: "Áudio",
  },
  {
    name: "Caixa de Som Portátil à Prova d'Água",
    description: "Caixa Bluetooth com certificação IPX7, 20W de potência e 12 horas de bateria.",
    priceCents: 34900,
    category: "Áudio",
  },
  {
    name: "Fone Intra-auricular com Fio",
    description: "Fone com microfone embutido e conector USB-C.",
    priceCents: 4990,
    category: "Áudio",
    image: false,
  },
  {
    name: "Notebook Volt Book 14 i5 16GB",
    description: "Notebook com processador Intel Core i5, 16GB de RAM, SSD de 512GB e tela Full HD de 14 polegadas.",
    priceCents: 429900,
    category: "Informática",
  },
  {
    name: "Mouse Sem Fio Ergonômico",
    description: "Mouse vertical com 6 botões, DPI ajustável até 2400 e conexão por receptor USB.",
    priceCents: 12990,
    category: "Informática",
  },
  {
    name: "Teclado Mecânico ABNT2",
    description: "Teclado mecânico com switches marrons, iluminação RGB e layout ABNT2.",
    priceCents: 28990,
    category: "Informática",
  },
  {
    name: "Carregador Turbo USB-C 30W",
    description: "Carregador de parede com Power Delivery 30W, compatível com smartphones e tablets.",
    priceCents: 8990,
    category: "Acessórios",
  },
  {
    name: "Cabo USB-C Reforçado 2m",
    description: "Cabo com revestimento em nylon trançado, suporta 60W e transferência de dados.",
    priceCents: 3990,
    category: "Acessórios",
    image: false,
  },
  {
    name: "Garrafa Térmica Inteligente com Display",
    description: "Garrafa de aço inox 500ml com display LED de temperatura na tampa. Mantém a bebida quente por 12 horas.",
    priceCents: 11990,
    category: "Acessórios",
  },
  {
    name: "Lâmpada Inteligente Wi-Fi RGB",
    description: "Lâmpada LED 10W com 16 milhões de cores, controle por aplicativo e assistente de voz.",
    priceCents: 7990,
    category: "Casa Inteligente",
  },
  {
    name: "Tomada Inteligente 10A",
    description: "Tomada Wi-Fi com agendamento e monitoramento de consumo pelo aplicativo.",
    priceCents: 6990,
    category: "Casa Inteligente",
  },
  {
    name: "Kit Presente Volt Tech",
    description: "Caixa presente com fone intra-auricular, carregador turbo, cabo USB-C e cartão. Para quem ama tecnologia.",
    priceCents: 16990,
    category: "Kits",
  },
  {
    name: "Kit Viagem Tech",
    description: "Power bank de 10000mAh, adaptador universal de tomada e case organizador de cabos.",
    priceCents: 24990,
    category: "Kits",
  },
];

/** "Caixa de Som à Prova d'Água" → "caixa-de-som-a-prova-d-agua" */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Deterministic placeholder: the same product always gets the same picture. */
export function imageUrlFor(product: SeedProduct): string | undefined {
  return product.image === false ? undefined : `https://picsum.photos/seed/${slugify(product.name)}/640/480`;
}
