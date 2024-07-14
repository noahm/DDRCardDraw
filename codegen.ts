import { CodegenConfig } from "@graphql-codegen/cli";
import baseConfig from "./graphql.config";

const config: CodegenConfig = {
  ...baseConfig,
  ignoreNoDocuments: false, // for better experience with the watcher
  generates: {
    "./src/startgg-gql/generated/": {
      preset: "client",
    },
  },
};

export default config;
