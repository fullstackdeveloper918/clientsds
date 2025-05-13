import {
  Link,
  Outlet,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Shopify styles
export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// Loader to check token for current session's shop
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;

  let tokenExists = false;

  if (shop) {
    const token = await prisma.apiToken.findFirst({
      where: { shop },
    });
    // Token must be valid (non-null and with a token string)
    tokenExists = !!(token && token.token);
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    tokenExists,
  };
};

// App Layout
export default function App() {
  const { apiKey, tokenExists } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        {tokenExists ? (
          <>
            <Link to="/app/storedata">Store Data</Link>
            <Link to="/app/saveapikey">Save Api Key</Link>
            <Link to="/app" rel="home">Home</Link>
           <Link to="/app/additional">How to add custom field</Link>
           <Link to="/app/meta">How to show  custom meta field in frontend</Link>
          </>
        ) : (
          <Link to="/app/saveapikey">Save Api Key</Link>
        )}
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Error boundary for Remix + Shopify
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// Required for Shopify to handle headers properly
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
