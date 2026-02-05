const path = require('path');
const nodeExternals = require('webpack-node-externals');
const { IgnorePlugin } = require('webpack'); 

module.exports = {
    mode: 'production',
    target: 'node',
    entry: './src/lambda.ts',
    externals: [
        nodeExternals({
            // Allow NestJS and related dependencies
            allowlist: [
                /@aws-sdk/, 
                /^@nestjs/, 
                /^rxjs/, 
                'class-validator', 
                'class-transformer',
                '@nestjs/websockets',
                '@nestjs/microservices',
                'xlsx-populate',
                'tslib',
                'dotenv',
                'pg',
                'knex'
            ],
            additionalModuleDirs: [path.resolve(__dirname, 'node_modules')]
        })
    ],
    output: {
        filename: 'lambda.js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'commonjs2',
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: 'tsconfig.json',
                        transpileOnly: true
                    }
                },
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            src: path.resolve(__dirname, 'src/'),
        },
    },
    optimization: {
        minimize: true
    },
    plugins: [
        new IgnorePlugin({
            resourceRegExp: /@mapbox\/node-pre-gyp/, // Ignore node-pre-gyp
        }),
        new IgnorePlugin({
            resourceRegExp: /@nestjs\/(websockets|microservices)/, // Ignore optional NestJS modules
        }),
        new IgnorePlugin({
            resourceRegExp: /\.html$/, // Ignore all HTML files
        }),
        new IgnorePlugin({
            resourceRegExp: /pg-native|mock-aws-s3|nock|class-validator|class-transformer|better-sqlite3|tedious|mysql|mysql2|oracledb|pg-query-stream|sqlite3/, // Ignore unnecessary modules
        }),
    ],
};