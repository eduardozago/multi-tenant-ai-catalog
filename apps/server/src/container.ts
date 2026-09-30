import { env } from "./config/env";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { PasswordHasher } from "./modules/auth/password";
import { TokenService } from "./modules/auth/token";
import { AgentService } from "./modules/chat/agent.service";
import { ChatController } from "./modules/chat/chat.controller";
import { ChatService } from "./modules/chat/chat.service";
import { ConversationRepository } from "./modules/chat/conversation.repository";
import { OpenAIProvider } from "./modules/chat/llm/openai.provider";
import type { LLMProvider } from "./modules/chat/llm/types";
import { createCatalogToolRegistry } from "./modules/chat/tools/registry";
import { CompanyRepository } from "./modules/companies/company.repository";
import { ProductController } from "./modules/products/product.controller";
import { ProductRepository } from "./modules/products/product.repository";
import { ProductService } from "./modules/products/product.service";
import { UserController } from "./modules/users/user.controller";
import { UserRepository } from "./modules/users/user.repository";
import { UserService } from "./modules/users/user.service";

export type ContainerOptions = {
  /** Tests inject FakeLLMProvider; production uses OpenAI with the env key and model. */
  llmProvider?: LLMProvider;
};

/** Composition root: the only place that decides which implementation each layer gets. */
export function createContainer(options: ContainerOptions = {}) {
  const companyRepository = new CompanyRepository();
  const userRepository = new UserRepository();
  const productRepository = new ProductRepository();
  const conversationRepository = new ConversationRepository();

  const hasher = new PasswordHasher();
  const tokens = new TokenService(env.JWT_SECRET, env.JWT_EXPIRES_IN);

  const authService = new AuthService(userRepository, companyRepository, hasher, tokens);
  const userService = new UserService(userRepository, hasher);
  const productService = new ProductService(productRepository);

  const llmProvider =
    options.llmProvider ??
    new OpenAIProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_MODEL,
      reasoningEffort: env.LLM_REASONING_EFFORT,
    });
  const agentService = new AgentService(llmProvider, createCatalogToolRegistry(productRepository), {
    maxIterations: env.AGENT_MAX_ITERATIONS,
  });
  const chatService = new ChatService(agentService, conversationRepository, companyRepository);

  return {
    tokens,
    authController: new AuthController(authService, tokens.ttlSeconds),
    userController: new UserController(userService),
    productController: new ProductController(productService),
    chatController: new ChatController(chatService),
  };
}

export type Container = ReturnType<typeof createContainer>;
