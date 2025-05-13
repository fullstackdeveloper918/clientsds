import {
  Form,
  json,
  useLoaderData,
  Link,
  useSearchParams,
  redirect,
  useActionData,
  useNavigation,
} from "@remix-run/react";

import { authenticate } from "../shopify.server";
import axios from "axios";
import { useEffect, useState } from "react";
import prisma from "../db.server"; // Ensure Prisma is setup
import styles from "../styles/style.module.css";

// Loader function to load data from the API
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search_string = url.searchParams.get("name");
  const product_id = url.searchParams.get("product_id");
  if (!product_id) {
    console.log("No product ID provided, redirecting to app.");
    return redirect("/app");
  }

  const productInf = await fetchProductDetailsFromShopify(session, product_id);

  const language_code = url.searchParams.get("language");
  const product_code = url.searchParams.get("product_code");
  console.log(product_code, "product_code");
  const region = (url.searchParams.get("region") || "en").toUpperCase();
  const page_size = 10;
  const page_index = parseInt(url.searchParams.get("page_index")) || 1;

  try {
    // Call the API to fetch the products based on page_index
    const data = await fetchProducts({
      search_string,
      language_code,
      page_size,
      page_index,
      session,
      product_code,
      region,
    });

    console.log("sss", data);

    return json({
      data: data?.results,
      messagefornoproduct: data?.message,
      total: data?.total,
      product_id: product_id,
      language_code: language_code,
      region: region,
      page_size: page_size,
      search_string: search_string,
      session: session,
      productInf: productInf,
      product_code: product_code,
      status: 200,
    });
  } catch (error) {
    // console.log("Error:", error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request); // Ensure session is
  const url = new URL(request.url);
  const product_id = url.searchParams.get("product_id");
  let metaField = false;

  const formData = await request.formData();
  const customer_id = formData.get("customer_id");

  console.log("ddd11 CHECK", formData);
  const sdspdf_id = formData.get("new_id");
  const pdf_id = formData.get("pdf_id");

  const product_id1 = url.searchParams.get("product_id");
  const descriptionData = formData.get("productInf");
  const { shop } = session;
  if (request.method === "POST") {
    //console.log("POST request received")
    try {
      const data = await fetchPermanentLink({
        customer_id,
        sdspdf_id,
        product_id1,
        session,
      });
      const description = data?.link;

      if (description) {
        const productData = JSON.stringify({
          product: {
            id: product_id,
            body_html: description,
          },
        });

        const config = {
          method: "put",
          maxBodyLength: Infinity,
          url: `https://${shop}/admin/api/2025-01/products/${product_id}.json`,
          headers: {
            "X-Shopify-Access-Token": session?.accessToken,
            "Content-Type": "application/json",
          },
          data: productData,
        };

        const productResponse = await axios.request(config);
        return json({
          message: "Shopify product updated successfully",
          status: 200,
          data: productResponse,
        });
      }
    } catch (err) {
      //console.log("Error in permanent link:", err);
      return json({
        message: "Something went wrong",
        status: 500,
        error: err.message,
        step: 5,
      });
    }
   }
   else if (request.method === "PUT") {
    try {
      console.log("PUT request received");
  
      const metafieldNamespace = "custom";
  
      // Step 1: Get existing metafield keys
      const metafieldDefQuery = {
        query: `{
          metafieldDefinitions(first: 100, namespace: "${metafieldNamespace}", ownerType: PRODUCT) {
            edges {
              node {
                key
              }
            }
          }
        }`,
      };
  
      const metafieldDefRes = await axios.post(
        `https://${session.shop}/admin/api/2023-10/graphql.json`,
        JSON.stringify(metafieldDefQuery),
        {
          headers: {
            "X-Shopify-Access-Token": session.accessToken,
            "Content-Type": "application/json",
          },
        }
      );
  
      const existingKeys = metafieldDefRes.data?.data?.metafieldDefinitions?.edges.map(edge => edge.node.key) || [];
  
      // Step 2: Get dynamic data
      const linkData = await fetchLinkOfPdf(sdspdf_id, pdf_id, session);
      const { permanent_link: sdsLink, extracted_data } = linkData || {};
  
      if (!sdsLink) throw new Error("No SDS link returned");
  
      const {
        ghs_pictograms = [],
        hazard_codes = [],
        precautionary_codes = [],
        signal_word = ""
      } = extracted_data || {};
  
      const metafieldsToHandle = [
        {
          key: "safety_data_sheet_permanent_link",
          type: "url",
          value: sdsLink,
        },
        {
          key: "ghs_pictograms",
          type: "multi_line_text_field",
          value: ghs_pictograms.map(url => `<img src="${url}" alt="ghs pictogram" style="width: 40px; height: 40px; object-fit: contain;" />`).join("\n") || "N/A",
        },
        {
          key: "precautionary_codes",
          type: "multi_line_text_field",
          value: precautionary_codes.map(item => `<div><strong>${item.statement_code}:</strong> ${item.translation}</div>`).join("\n") || "N/A",
        },
        {
          key: "hazard_codes",
          type: "multi_line_text_field",
          value: hazard_codes.map(item => `<div><strong>${item.statement_code}:</strong> ${item.translation}</div>`).join("\n") || "N/A",
        },
        {
          key: "signal_word",
          type: "single_line_text_field",
          value: signal_word || "N/A",
        }
      ];
  
      const metafieldsToUpdate = [];
  
      // Step 3: Clear all relevant metafields with "N/A"
      for (const metafield of metafieldsToHandle) {
        const { key, type } = metafield;
  
        if (!existingKeys.includes(key)) {
          // Create definition if not exists
          await authenticate.admin(request).then(({ admin }) =>
            admin.graphql(
              `mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
                metafieldDefinitionCreate(definition: $definition) {
                  createdDefinition { id }
                  userErrors { message }
                }
              }`,
              {
                variables: {
                  definition: {
                    name: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
                    namespace: metafieldNamespace,
                    key,
                    type,
                    ownerType: "PRODUCT",
                  },
                },
              }
            )
          );
        }
  
        metafieldsToUpdate.push({
          key,
          namespace: metafieldNamespace,
          ownerId: `gid://shopify/Product/${product_id}`,
          type,
          value: "N/A",
        });
      }
  
      // Step 4: Apply "N/A" values first
      await axios.post(
        `https://${session.shop}/admin/api/2023-10/graphql.json`,
        JSON.stringify({
          query: `
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields { id key value }
                userErrors { field message }
              }
            }`,
          variables: { metafields: metafieldsToUpdate },
        }),
        {
          headers: {
            "X-Shopify-Access-Token": session.accessToken,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Metafields set to N/A:", metafieldsToUpdate.map(m => m.key));
  
      // Step 5: Now update with actual values
      const metafieldsWithActualValues = metafieldsToHandle.map(({ key, type, value }) => ({
        key,
        namespace: metafieldNamespace,
        ownerId: `gid://shopify/Product/${product_id}`,
        type,
        value,
      }));
  
      await axios.post(
        `https://${session.shop}/admin/api/2023-10/graphql.json`,
        JSON.stringify({
          query: `
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields { id key value }
                userErrors { field message }
              }
            }`,
          variables: { metafields: metafieldsWithActualValues },
        }),
        {
          headers: {
            "X-Shopify-Access-Token": session.accessToken,
            "Content-Type": "application/json",
          },
        }
      );
  
      console.log("Metafields updated with actual values:", metafieldsWithActualValues.map(m => m.key));
  
      return json({ message: "Metafields cleared and updated." });
    } catch (error) {
      console.error("PUT error:", error.message);
      return json({ error: "Update failed", details: error.message }, { status: 500 });
    }
  }
  

 

 
  

  
  
  
}

export default function StoreData() {
  const {
    data,
    total,
    product_id,
    productInf,
    session,
    product_code,
    messagefornoproduct,
  } = useLoaderData();
  //console.log("dataStoreData",data);
  const actionRes = useActionData();
  const navigation = useNavigation();
  const productBodyhtml = productInf?.product?.body_html;
  const [isPopupOpen, setPopupOpen] = useState(false);
  const [isLoading, setisLoading] = useState(false);

  const [itemData, setItemData] = useState("");
  const [descriptionData, setDescriptionData] = useState("");
  const [searchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page_index")) || 0;
  const pageSize = Number(searchParams.get("page_size")) || 10;
  const [open, setOpen] = useState("");

  const totalPages = Math.ceil(total / pageSize);
  const lastPageIndex = totalPages - 1;

  const maxPages = 5;
  const halfMaxPages = Math.floor(maxPages / 2);

  const canPageBackwards = currentPage > 0;
  const canPageForwards = currentPage < lastPageIndex;

  const pageNumbers = [];
  if (totalPages <= maxPages) {
    for (let i = 0; i < totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    let startPage = currentPage - halfMaxPages;
    let endPage = currentPage + halfMaxPages;

    if (startPage < 0) {
      endPage += Math.abs(startPage);
      startPage = 0;
    }

    if (endPage >= totalPages) {
      startPage -= endPage - lastPageIndex;
      endPage = lastPageIndex;
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
  }
  useEffect(() => {
    if (actionRes) {
      //console.log(actionRes, "actionRes");

      if (actionRes?.metaField) {
        setOpen("success");
      } else {
        setOpen("error");
      }

      const timer = setTimeout(() => {
        setOpen(null); // or false, depending on how you're handling the open state
      }, 7000);

      // Cleanup the timeout when the component unmounts or `actionRes` changes
      return () => clearTimeout(timer);
    }
  }, [actionRes]);

  function setSearchParamsString(searchParams, changes) {
    const newSearchParams = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) {
        newSearchParams.delete(key);
        continue;
      }
      newSearchParams.set(key, String(value));
    }

    return `?${newSearchParams.toString()}`;
  }
  const [clickedIndex, setClickedIndex] = useState(null);
  const [selectedNewId, setSelectedNewId] = useState(null);
  const handleClick = (index, selectId) => {
    setClickedIndex(index);
    setSelectedNewId(selectId);
  };
  return (
    <>
      {/* <Form method='PUT' > */}
      <div className={styles.container}>
        {/* Table with conditional rendering for data */}
        {messagefornoproduct && (
          <p className={styles.paragraph}>
            <span className={styles.span_class}>
              {messagefornoproduct.search_string}
            </span>{" "}
            {messagefornoproduct.text}
            <br />
            {messagefornoproduct.text1}
          </p>
        )}
        {data && data.length > 0 ? (
          <table className={styles.sdsTable}>
            <thead>
              <tr>
                <th className={styles.sdsPrct}>Product Name</th>
                <th className={styles.sdsPrct}>Supplier Name</th>
                <th className={styles.sdsPrct}>Product Code</th>
                <th className={styles.sdsPrct}>REG. CODE</th>
                <th className={styles.sdsLang}>Language</th>
                <th className={styles.sdsDate}>Date</th>
                <th className={styles.sdsActn}>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
                  <td title={item?.sds_pdf_product_name}>
                    {item?.sds_pdf_product_name || "No Name Available"}
                  </td>
                  <td>{item?.sds_pdf_manufacture_name || ""}</td>
                  <td>{item?.product_code || ""}</td>
                  <td>{item?.regulation_area}</td>
                  <td>{item?.language || ""}</td>
                  <td>{item?.master_date || ""}</td>

                  {/* 👇 HAR ROW KA APNA FORM */}
                  <td>
                    <Form method="put">
                      <input type="hidden" name="customer_id" value={1865} />
                      <input
                        type="hidden"
                        name="new_id"
                        value={item?.id || 0}
                      />
                      <input
                        type="hidden"
                        name="pdf_id"
                        value={item?.pdf_md5 || 0}
                      />
                      <input
                        type="hidden"
                        name="main_id"
                        value={item?.id || 0}
                      />
                      <input
                        type="hidden"
                        name="product_id"
                        value={product_id}
                      />
                      <input
                        type="hidden"
                        name="productInf"
                        value={productBodyhtml}
                      />

                      <button
                        type="submit"
                        name="productInf"
                        value={productBodyhtml}
                        className={styles.actionButton}
                        onClick={() => setClickedIndex(index)}
                      >
                        {navigation.state === "submitting" &&
                        clickedIndex === index
                          ? "Adding info..."
                          : "Add"}
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No data available</p>
        )}

        {open === "success" && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "#f9f9f9",
              padding: "40px 30px",
              borderRadius: "20px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
              zIndex: 1000,
              maxWidth: "90%",
              width: "400px",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                marginBottom: "15px",
                fontSize: "22px",
                color: "#2c3e50",
              }}
            >
              ✅ Success!
            </h2>
            <p
              style={{ fontSize: "18px", color: "#34495e", lineHeight: "1.5" }}
            >
              Safety Data Sheet link is added to product{" "}
              <strong>{productInf?.product?.title}</strong>
              has been added to the product description field
              <br />
              <strong>
                PS: You can set up a meta field to have the link show as a
                separate link outside of the product descrilption"
              </strong>
              
            </p>
            <p style={{ fontSize: "16px", color: "#7f8c8d", marginBottom: "10px" }}>
  <strong>Note:</strong> If you have not added the custom metafield through
  configuration...
</p>
<Link to="/app/meta">
  <button
    style={{
      backgroundColor: "#e74c3c", // red
      color: "#fff",
      fontSize: "18px",
      padding: "10px 20px",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
    }}
  >
    Read More
  </button>
</Link>
          </div>
        )}

        {open === "error" && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "#f9f9f9",
              padding: "40px 30px",
              borderRadius: "20px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
              zIndex: 1000,
              maxWidth: "90%",
              width: "400px",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                marginBottom: "15px",
                fontSize: "22px",
                color: "#2c3e50",
              }}
            >
              ✅ Success!
            </h2>
            <p
              style={{ fontSize: "18px", color: "#34495e", lineHeight: "1.5" }}
            >
              Safety Data Sheet link is added to product{" "}
              <stong>{productInf?.product?.title}</stong>
              <br />
              <strong>Go and check in the product.</strong>
              
            </p>
            <p style={{ fontSize: "16px", color: "#7f8c8d", marginBottom: "10px" }}>
  <strong>Note:</strong> If you have not added the custom metafield through
  configuration...
</p>
<Link to="/app/meta">
  <button
    style={{
      backgroundColor: "#e74c3c", // red
      color: "#fff",
      fontSize: "18px",
      padding: "10px 20px",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
    }}
  >
    Read More
  </button>
</Link>
            
  
          </div>
        )}

        {/* Pagination Section */}
        <div className={styles.pagination}>
          <button
            className={`${styles.paginationButton} ${!canPageBackwards ? styles.disabled : ""}`}
            disabled={!canPageBackwards}
          >
            <Link
              to={setSearchParamsString(searchParams, { page_index: 0 })}
              preventScrollReset
              prefetch="intent"
              className="text-neutral-600"
            >
              First
            </Link>
          </button>

          <button
            className={`${styles.paginationButton} ${!canPageBackwards ? styles.disabled : ""}`}
            disabled={!canPageBackwards}
          >
            <Link
              to={setSearchParamsString(searchParams, {
                page_index: Math.max(currentPage - 1, 0),
              })}
              preventScrollReset
              prefetch="intent"
              className="text-neutral-600"
            >
              Prev
            </Link>
          </button>

          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              className={`${styles.paginationButton} ${pageNumber === currentPage ? styles.active : ""}`}
              disabled={pageNumber === currentPage}
            >
              <Link
                to={setSearchParamsString(searchParams, {
                  page_index: pageNumber,
                })}
                preventScrollReset
                prefetch="intent"
                className="px-3 py-1 rounded-md"
              >
                {pageNumber}
              </Link>
            </button>
          ))}

          <button
            className={`${styles.paginationButton} ${!canPageForwards ? styles.disabled : ""}`}
            disabled={!canPageForwards}
          >
            <Link
              to={setSearchParamsString(searchParams, {
                page_index: currentPage + 1,
              })}
              preventScrollReset
              prefetch="intent"
              className="text-neutral-600"
            >
              Next
            </Link>
          </button>

          <button
            className={`${styles.paginationButton} ${!canPageForwards ? styles.disabled : ""}`}
            disabled={!canPageForwards}
          >
            <Link
              to={setSearchParamsString(searchParams, {
                page_index: lastPageIndex,
              })}
              preventScrollReset
              prefetch="intent"
              className="text-neutral-600"
            >
              Last
            </Link>
          </button>
        </div>
      </div>

      {/* </Form> */}
    </>
  );
}

//older version
// async function fetchProducts(searchParams) {
//   const { search_string, language_code, page_size, page_index ,session ,product_code} = searchParams;

//   const accesTokenThirdParty =  await  getTokenThirdParty(session);
//   console.log(accesTokenThirdParty, "accesTokenfetchProducts")

//   console.log(page_size, "page size");
//   console.log(page_index, "page_index");
//   const apiUrl = `https://discovery.sdsmanager.com/webshop/sds_search?search_string=${search_string}&language_code=${language_code}&page_size=${page_size}&page_index=${page_index}&product_code=${product_code}`;

//   const accessToken =accesTokenThirdParty.access_token
//     // Make sure to keep your token secure

//   try {
//     const res = await fetch(apiUrl, {
//       method: "GET",
//       headers: {
//         Authorization: `Bearer ${accessToken}`, // Fixing the string interpolation
//         "Content-Type": "application/json",
//       },
//     });

//     if (!res.ok) {
//       throw new Error(`Failed to fetch products: ${res.status}`);
//     }

//     const data = await res.json();
//     return data;
//   } catch (error) {
//     console.error("Error fetching products:", error);
//     throw error;
//   }
// }
// Helper function to fetch permanent link

async function fetchProducts(searchParams) {
  const {
    search_string,
    language_code,
    page_size,
    page_index,
    session,
    region,
    product_code,
  } = searchParams;

  const { token: accessToken } = await getTokenThirdParty(session);
  if (!accessToken) {
    console.error("No access token found for the session.");
    return false;
  }
  

  const apiUrl = `${process.env.API_URL_SEARCH}/?page_size=${page_size}&page=${page_index}`;
 //const apiKey = process.env["X_Sds_Search_Access_Api_Key"];
 const apiKey =   accessToken ;


  const createRequestBody = (search_type) => ({
    search: search_string,
    language_code: language_code,
    region_short_name: region,
    search_type: search_type,
    order_by: null,
    minimum_revision_date: null,
  });

  try {
    // First request with default search type
    const firstBody = createRequestBody(process.env.DEFAULT_SEARCHTYPE);
    let res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "X-Sds-Search-Access-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(firstBody),
    });

    if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);

    let data = await res.json();
    console.log(data, "firstdata");
    // If no results in the first call
    if (!Array.isArray(data) || data.length === 0) {
      // Retry with search_type = "match"
      const secondBody = createRequestBody("close_search");

      res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "X-Sds-Search-Access-Api-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(secondBody),
      });

      if (!res.ok) throw new Error(`Second fetch failed: ${res.status}`);

      const secondData = await res.json();
      console.log(secondData, "secondData");

      const data = {
        search_string,
        text: "did not match any SDS in our database.",
        text1: " Showing similar results.",
      };
      return {
        results: Array.isArray(secondData) ? secondData : [],
        message: data,
      };
    }
    // Successful first call
    return {
      results: data,
    };
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
}
async function fetchPermanentLink({
  customer_id,
  sdspdf_id,
  product_id,
  session,
}) {
  const accesToken = await getTokenThirdParty(session);
  console.log(accesToken, "accesTokenfetchPermanentLink");

  console.log(customer_id, sdspdf_id, product_id, "data sending");
  const apiUrl = `https://discovery.sdsmanager.com/webshop/get_permanent_link?customer_id=${customer_id}&sdspdf_id=${sdspdf_id}&product_id=${product_id}`;

  const accessToken =
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsdWFuYmU2OCtuZXRwb3dlcl90ZXN0QGdtYWlsLmNvbSIsImV4cCI6MTc0Mzc3MzYyNX0.yr9AEkV84J2FF8lCDrbw-L0ASroJ5MCmmlgLANrTFmY"; // Make sure to keep your token secure

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`, // Fixing the string interpolation
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log(data, "data here2");
    return data;
  } catch (error) {
    console.error("Error fetching permanent link:", error);
    throw error;
  }
}

// async function fetchLinkOfPdf( id, product_id, value ,session) {
//   console.log(id, product_id, value, "data sending11");

//   const accesTokenThirdParty =  await  getTokenThirdParty(session);
//    console.log(accesTokenThirdParty, "accesTokenfetchLinkOfPdf")

//   const apiUrl = `https://discovery.sdsmanager.com/webshop/get_permanent_link?customer_id=${value}&sdspdf_id=${id}&product_id=${product_id}`;

//   const accessToken =accesTokenThirdParty.access_token ;
//     // Make sure to keep your token secure

//   try {
//     const response = await fetch(apiUrl, {
//       method: "GET",
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type": "application/json",
//       },
//     });

//     if (!response.ok) {
//       throw new Error(`API request failed with status ${response.status}`);
//     }

//     const data = await response.json();
//     console.log(data, "data here");
//     return data;
//   } catch (error) {
//     console.error("Error fetching permanent link:", error);
//     throw error;
//   }
// }

async function fetchLinkOfPdf(sds_id, pdf_md5 ,session) {
  const { token: accessToken } = await getTokenThirdParty(session);
  if (!accessToken) {
    console.error("No access token found for the session.");
    return false;
  }

  console.log(pdf_md5, sds_id, "data sending11");

  const apiUrl = process.env.API_URL_DETAILS;
  //const apiKey = process.env.X_Sds_Search_Access_Api_Key;
  const apiKey = accessToken ;

  if (!apiUrl || !apiKey) {
    console.error("Missing API URL or API Key from environment variables.");
    return;
  }

  const payload = {
    sds_id, // encrypted SDS ID (long string)
    pdf_md5, // MD5 hash (short string)
    language_code: null,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Sds-Search-Access-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(`API request failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log(result, "data here");
    return result;
  } catch (error) {
    console.error("Error fetching permanent link:", error);
    throw error;
  }
}

async function fetchProductDetailsFromShopify(session, product_id) {
  return new Promise((resolve, reject) => {
    const config = {
      method: "get",
      maxBodyLength: Infinity,
      url: `https://${session.shop}/admin/api/2025-01/products/${product_id}.json`,
      headers: {
        "X-Shopify-Access-Token": session.accessToken,
        "Content-Type": "application/json",
      },
    };

    axios
      .request(config)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        console.error("Error fetching product details:", error);
        reject(error);
      });
  });
}

async function getTokenThirdParty(session) {
  try {
    const shopName = session?.shop;

    if (!shopName) {
      throw new Error("Invalid session: shop name not found.");
    }

    const token = await prisma.apiToken.findFirst({
      where: { shop: shopName },
    });

    if (!token) {
      throw new Error(`Token not found for shop: ${shopName}`);
    }

    return token;
  } catch (error) {
    console.error("Error fetching third-party token:", error.message);
    throw new Error("Failed to retrieve third-party token.");
  }
}

