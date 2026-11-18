# Conecta Escola

Sistema web acadêmico para gestão de internet e serviços digitais destinados aos funcionários de um colégio.

## Objetivo
Centralizar orientações de Wi-Fi institucional, controle de equipamentos compartilhados (como o computador da sala dos professores), comunicados e solicitações de suporte técnico.

## Funcionalidades da primeira versão
- Login e encerramento de sessão.
- Perfis de administrador e funcionário.
- Cadastro, consulta, atualização e desativação de usuários (administrador).
- Cadastro, consulta, atualização e exclusão de equipamentos (administrador).
- Abertura e acompanhamento de solicitações de suporte.
- Atualização do status de chamados pelo administrador.
- Comunicados institucionais.
- Orientações para acesso ao Wi-Fi.
- Histórico de operações administrativas.
- Interface responsiva para computador, tablet e celular.
- Senhas armazenadas com hash bcrypt e consultas persistidas em SQLite.

## Tecnologias
- HTML5, CSS3 e JavaScript no front-end.
- Node.js e Express no back-end.
- SQLite com better-sqlite3 para persistência.
- bcryptjs para hash de senhas.
- express-session para sessão autenticada.

## Como executar localmente
1. Instale o Node.js 18 ou superior: https://nodejs.org/
2. Extraia/clonar este repositório e abra a pasta `conecta-escola` no terminal.
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Inicie o sistema:
   ```bash
   npm start
   ```
5. Abra no navegador: http://localhost:3000

O banco SQLite é criado automaticamente em `data/conecta-escola.db` na primeira execução.

## Acesso inicial de demonstração
- E-mail: `admin@conectaescola.com`
- Senha: `Admin@123`

Altere a senha de demonstração antes de qualquer uso real. O projeto é um MVP acadêmico; para produção, configure uma chave de sessão forte, HTTPS, política de backup, recuperação de senha por e-mail, proteção CSRF, limitação de tentativas de login e revisão de segurança.

## Organização das pastas
```text
conecta-escola/
├── data/                 # banco SQLite criado na primeira execução
├── public/
│   ├── app.js             # comportamento das telas
│   ├── index.html         # estrutura da interface
│   └── style.css          # estilos responsivos
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js              # API, autenticação e regras de negócio
```

## Relação com os requisitos
O MVP implementa autenticação, perfis, operações CRUD, validações, mensagens, exclusão lógica de usuários, registro de auditoria e responsividade. Os requisitos de disponibilidade institucional, backup automático, recuperação real por e-mail e auditoria ampliada precisam de infraestrutura/configuração adicional e não são considerados concluídos apenas por este protótipo.

## Publicação no GitHub
1. Crie uma conta em https://github.com/ (se ainda não tiver).
2. Clique em **New repository**.
3. Nome sugerido: `conecta-escola`; escolha **Public** se o professor precisar acessar sem convite.
4. Não marque a opção de criar README, pois este projeto já tem um.
5. No computador, abra o terminal dentro da pasta do projeto e execute:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão do Conecta Escola"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/conecta-escola.git
   git push -u origin main
   ```
6. Substitua `SEU-USUARIO` pelo seu nome de usuário do GitHub.
7. Copie o endereço do repositório e envie ao professor.

> O GitHub guarda o código-fonte; ele não coloca automaticamente o sistema no ar. Para demonstração online, será necessário publicar o back-end em um serviço de hospedagem compatível com Node.js e configurar armazenamento persistente para o SQLite.
