# Node.js 18の軽量版イメージをベースとして使用
FROM node:18-alpine

# コンテナ内の作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（devDependenciesも含む）
RUN npm install

# アプリケーションのソースコードをコンテナにコピー
COPY . .

# アプリケーションがリッスンするポートを公開
EXPOSE 3000

# アプリケーションを起動するコマンドを設定
CMD [ "npm", "start" ]
