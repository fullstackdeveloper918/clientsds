import {
  Box,
  Card,
  Layout,
  Page,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import styles from "../styles/style.module.css"

export default function AdditionalPage() {
  return (
    <Page>
      <TitleBar title="Additional Page" />
      <Layout>
        <Layout.Section>
          <Card className={styles.card}>
          <div className={styles.container}>
      <h2 className={styles.pageTitle}>How to Store the Safety Data Sheet (SDS) Link in a Metafield</h2>
      <p className={styles.intro}>
        To store the Safety Data Sheet (SDS) link in a metafield, follow these steps:
      </p>
      <div className={styles.steps}>
        <div className={styles.step}>
          <div className={styles.stepNumber}>1</div>
          <div className={styles.stepDescription}>
            <strong>Go to Shopify Admin:</strong>
            <p>Log in to your Shopify admin panel. Navigate to <strong>Settings &gt; Custom Data</strong>.</p>
          </div>
        </div>
        <div className={styles.step}>
          <div className={styles.stepNumber}>2</div>
          <div className={styles.stepDescription}>
            <strong>Add a Metafield Definition for Products:</strong>
            <p>Under "Custom Data," click on <strong>Products</strong>. Then, click <strong>Add definition</strong>.</p>
          </div>
        </div>
        <div className={styles.step}>
          <div className={styles.stepNumber}>3</div>
          <div className={styles.stepDescription}>
            <strong>Configure the Metafield:</strong>
            <ul>
              <li><strong>Name:</strong> Set to "Safety Data Sheet".</li>
              <li><strong>Namespace and Key:</strong> Set to <code>http://custom.safety_data_sheet_permanent_link</code>.</li>
              <li><strong>Description:</strong> "Safety Data Sheet"</li>
              <li><strong>Select Type:</strong> Choose <strong>URL</strong></li>
              <li><strong>Validation:</strong> Leave this field as it is.</li>
              <li><strong>Access:</strong> Check the box for <strong>Storefronts</strong> to make the metafield available on the front end.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Code({ children }) {
  return (
    <Box
      as="span"
      padding="025"
      paddingInlineStart="100"
      paddingInlineEnd="100"
      background="bg-surface-active"
      borderWidth="025"
      borderColor="border"
      borderRadius="100"
    >
      <code className={styles.code}>{children}</code>
    </Box>
  );
}
