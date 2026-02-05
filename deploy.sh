# Set Environment
ENVIRONMENT=${1:-dev}

# Map environment to AWS profile
if [ "$ENVIRONMENT" == "prod" ]; then
  AWS_PROFILE="prod-storrefranca"
else
  AWS_PROFILE="dev-storrefranca"
fi

echo "Deploying to $ENVIRONMENT using AWS profile: $AWS_PROFILE"

# Clean previous builds
rm -rf dist/ .aws-sam/ lambda-layers/aws/nodejs/node_modules lambda-layers/framework/nodejs/node_modules

npm install
npm run build

# Verify dist/ contains your Lambda handler
if [ ! -f dist/lambda.js ] && [ ! -f dist/lambda.mjs ] && [ ! -f dist/lambda.ts ]; then
  echo "❌ dist/ does not contain a lambda handler file (e.g., dist/lambda.js)"
  exit 1
fi

cd lambda-layers/framework/nodejs
npm install --omit=dev
cd ../../../

cd lambda-layers/aws/nodejs
npm install --omit=dev
cd ../../../

# Prepare dist/ with minimal package.json
cp package.json dist/package.json
jq 'del(.dependencies, .devDependencies, .scripts)' package.json > dist/package.json

# Build and Deploy using AWS SAM
export AWS_PROFILE=$AWS_PROFILE
sam build
sam deploy --config-env $ENVIRONMENT --parameter-overrides "EnvironmentType=$ENVIRONMENT"