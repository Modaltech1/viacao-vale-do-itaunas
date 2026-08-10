# Videotelemetria - POC

## Escopo atual

A integração permite que administradores autorizados para um veículo:

- consultem o dispositivo de videotelemetria vinculado;
- visualizem os canais cadastrados no Supabase;
- consultem o estado da transmissão;
- iniciem um canal ao vivo;
- abram o player temporário em uma nova aba;
- encerrem a transmissão.

O frontend chama somente as rotas internas do sistema. A chave e o endereço da API do
Gateway são lidos exclusivamente no servidor.

## Variáveis de ambiente

Configure no ambiente local e na plataforma de deploy:

```env
PRODEXY_GATEWAY_BASE_URL=http://seu-gateway:7010
PRODEXY_GATEWAY_API_KEY=<segredo>
PRODEXY_GATEWAY_POC_TERMINAL_ID=<terminal-habilitado-na-poc>
```

Nunca use o prefixo `NEXT_PUBLIC_` nessas variáveis.

## Limitações conhecidas

- O Gateway aceita somente o terminal configurado em `PRODEXY_GATEWAY_POC_TERMINAL_ID`.
- Existe apenas uma transmissão ativa por vez.
- Iniciar outro canal substitui ou encerra a transmissão anterior.
- O playback histórico e o download de gravações não fazem parte desta etapa.
- O player atual usa HTTP e, por isso, é aberto em uma nova aba em vez de iframe.
- A URL e o token temporários não são persistidos no banco.

## Preparação para produção

Antes da disponibilização definitiva:

- publicar o Gateway e o player em domínio com HTTPS e certificado TLS;
- revisar a exposição pública da porta da API;
- permitir no Security Group da AWS o tráfego originado pelo backend implantado;
- considerar um proxy seguro para a API;
- confirmar que o deploy consegue alcançar o Gateway.

Falhas de conectividade causadas por Security Group ou ausência de rota de rede devem
ser corrigidas na infraestrutura, não no frontend.
