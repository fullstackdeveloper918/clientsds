import {
    Page,
    Layout,
    Card,
    Button,
    Text,
    BlockStack,
    InlineStack,
    Box, // ← Add this
  } from "@shopify/polaris";
  import { TitleBar } from "@shopify/app-bridge-react";
  import { useState } from "react";
  import styles from "../styles/style.module.css";
  
  export default function CustomAppBlockPage() {
    const [copied, setCopied] = useState(false);
  
    const liquidCode = `<div class="page-width">
    {% assign sds_link = product.metafields.custom.safety_data_sheet_permanent_link | strip | upcase %}
    {% if sds_link != "" and sds_link != "N/A" %}
      <p><strong>SDS Link:</strong>
        <a href="{{ product.metafields.custom.safety_data_sheet_permanent_link }}" target="_blank">
          Click here for the SDS
        </a>
      </p>
    {% endif %}
  
    {% assign ghs = product.metafields.custom.ghs_pictograms | strip | upcase %}
    {% if ghs != "" and ghs != "N/A" %}
      <p class="pictogram"><strong>GHS pictogram:</strong> {{ product.metafields.custom.ghs_pictograms }}</p>
    {% endif %}
  
    {% assign precaution = product.metafields.custom.precautionary_codes | strip | upcase %}
    {% if precaution != "" and precaution != "N/A" %}
      <p><strong>Precautionary Codes:</strong> {{ product.metafields.custom.precautionary_codes }}</p>
    {% endif %}
  
    {% assign hazard = product.metafields.custom.hazard_codes | strip | upcase %}
    {% if hazard != "" and hazard != "N/A" %}
      <p><strong>Hazard Codes:</strong> {{ product.metafields.custom.hazard_codes }}</p>
    {% endif %}
  
    {% assign signal = product.metafields.custom.signal_word | strip | upcase %}
    {% if signal != "" and signal != "N/A" %}
      <p><strong>Signal Word:</strong> {{ product.metafields.custom.signal_word }}</p>
    {% endif %}
  </div>
<style>
p.pictogram {
    display: flex;
}
</style>`;
  
    const handleCopy = () => {
      navigator.clipboard.writeText(liquidCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };
  
    return (
      <Page>
        <TitleBar title="Display Custom App Block on Product Template" />
        <Layout>
          <Layout.Section>
            <Card>
              <div className={styles.container}>
                <h2 className={styles.pageTitle}>
                  Steps to Display a Custom App Block on Your Shopify Product Template
                </h2>
  
                <div className={styles.steps}>
                  {[
                    "Log into Shopify Admin: Open the Shopify admin dashboard.",
                    "Select Your Online Store: From the left-hand menu, select Online Store.",
                    "Choose Themes: Under Online Store, click on Themes to view your store's themes.",
                    "Select the Theme for Customization: Find the theme you want to customize and click Customize.",
                    "Open Theme Customization: Ensure you're on the product page or template you want to customize.",
                    "Choose the Product Template: In the left sidebar, select the Product template where the app block should appear.",
                    "Add Custom Liquid Block: Within the product template, add a Custom Liquid block or section.",
                    "Paste the Code: Paste the Liquid code below into the block to fetch product metafields.",
                    "Save Changes: Click Save to apply your changes.",
                  ].map((step, index) => (
                    <div className={styles.step} key={index}>
                      <div className={styles.stepNumber}>{index + 1}</div>
                      <div className={styles.stepDescription}>{step}</div>
                    </div>
                  ))}
  
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text variant="headingSm" as="h3">Copy the Code Below</Text>
                      <Button onClick={handleCopy} size="slim">
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </InlineStack>
                    <div className={styles.codeBlock}>
                      <pre>
                        <code>{liquidCode}</code>
                      </pre>
                    </div>
                  </BlockStack>

                  <Card>
                  <Card>
  <BlockStack gap="400">
    <Text variant="headingMd" as="h3">
      📺 Watch Video: Add SDS Info to Storefront
    </Text>
    <Text variant="bodyMd">
      Need help following the steps? Watch this video for a step-by-step walkthrough.
    </Text>
    <Box paddingBlockStart="200">
      <video
        controls
        width="100%"
        style={{ borderRadius: "12px", maxHeight: "500px" }}
      >
        <source src="/videos/screen-capture (22).webm" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </Box>
  </BlockStack>
</Card>

</Card>

                </div>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  
