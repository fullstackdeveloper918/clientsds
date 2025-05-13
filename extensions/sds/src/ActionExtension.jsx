import { useCallback, useEffect, useState } from "react";
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  TextField,
  Select,
  Link,
} from "@shopify/ui-extensions-react/admin";
const TARGET = "admin.product-details.action.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  const { i18n, close, data } = useApi(TARGET);
  const [productTitle, setProductTitle] = useState("");
  const [name, setName] = useState('');
  // [productCode, setProductCode] = useState('');
  const [language, setLanguage] = useState('en');
  const [region, setRegion] = useState('All');
  const [vendor, setVendor] = useState('');

  console.log('datahence', data);

  useEffect(() => {
    (async function getProductInfo() {
      const getProductQuery = {
        query: `query Product($id: ID!) {
          product(id: $id) {
            title
            vendor
          }
        }`,
        variables: { id: data.selected[0].id },
      };

      const res = await fetch("shopify:admin/api/graphql.json", {
        method: "POST",
        body: JSON.stringify(getProductQuery),
      });

      if (!res.ok) {
        console.error("Network error");
      }

      const productData = await res.json();
      setVendor(productData?.data?.product?.vendor || "");
      console.log('productData', productData?.data?.product?.vendor);
      setName(productData?.data?.product?.title + ' '+ (productData?.data?.product?.vendor || ""));
      setProductTitle(productData.data.product.title);
    })();
  }, [data.selected]);

  const handleSearchUrl = () => {
    // Construct the query string dynamically
    const queryParams = new URLSearchParams({
      name: name,
      product_id: data.selected[0].id.split('/').pop(),
     // product_code: productCode,
      language: language,
      region: region,
      page_size: 10,
      page_index: 1,

    }).toString();

    return `apps/sds-manager-app/app/storedata?${queryParams}`;
  };

  return (
    <AdminAction
      primaryAction={
        <Link to={handleSearchUrl()}>
          <Button>
            Search
          </Button>
        </Link>
      }
    >
      <BlockStack>
        <TextField label="Product Name - Supplier Name" value={name} onChange={(value) => setName(value)} />
        {/* <TextField label="Product Code" value={productCode} onChange={(value) => setProductCode(value)} /> */}

        <Select
          label="Language"
          value={language}
          onChange={(value) => setLanguage(value)}
          options={[
            { value: "en", label: "English" },
            { value: "ak", label: "Akan" },
            { value: "am", label: "Amharic" },
            { value: "ar", label: "Arabic" },
            { value: "as", label: "Assamese" },
            { value: "bo", label: "Tibetan" },
            { value: "cs", label: "Czech" },
            { value: "cy", label: "Welsh" },
            { value: "de", label: "German" },
            { value: "el", label: "Greek" },
            { value: "es", label: "Spanish" },
            { value: "fi", label: "Finnish" },
            { value: "fr", label: "French" },
            { value: "ga", label: "Irish" },
            { value: "hr", label: "Croatian" },
            { value: "id", label: "Indonesian" },
            { value: "ja", label: "Japanese" },
            { value: "ko", label: "Korean" },
            { value: "pl", label: "Polish" },
            { value: "pt", label: "Portuguese" },
            { value: "ro", label: "Romanian" },
          ]}
        />
        <Select
          label="Region"
          value={region}
          onChange={setRegion}
          options={[
            { value: "All", label: "All" },
            { value: "au", label: "Australia" },
            { value: "ca", label: "Canada" },
            { value: "fi", label: "Finland" },
            { value: "us", label: "United States" },
          ]}
        />
      </BlockStack>
    </AdminAction>
  );
}
