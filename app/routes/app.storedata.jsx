import {
  Form,
  json,
  useLoaderData,
  Link,
  useSearchParams,
  redirect, 
  useActionData,
  
  useNavigation
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
    return redirect('/app');
  }

  const productInf = await fetchProductDetailsFromShopify(session, product_id);

  const language_code = url.searchParams.get("language");
  const product_code = url.searchParams.get("product_code");
  console.log(product_code, "product_code");
  const region = url.searchParams.get("region") || "en";
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
      product_code
    });

    console.log("sss",data)

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
      product_code:product_code,
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
  let metaField = false

  const formData = await request.formData();
  const customer_id = formData.get("customer_id");
  const sdspdf_id = formData.get("new_id");
  //console.log("ddd11 CHECK",formData);
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
        session
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
        step:5
      });
    }
  } 
  else if (request.method === "PUT") {
    //e.log("Put request received")
    try {
      // Step 1: Check if metafield definition exists
      const metafieldDefQuery = {
        query: `{
          metafieldDefinitions(first: 100, namespace: "custom", ownerType: PRODUCT) {
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

      const metafields = metafieldDefRes.data?.data?.metafieldDefinitions?.edges || [];
      const metafieldKeys = metafields.map((edge) => edge.node.key);
      const metafieldKey = "safety_data_sheet_permanent_link";

      // Step 2: Get SDS link from your own service
      const linkData = await fetchLinkOfPdf(sdspdf_id, product_id, customer_id, session);
      //console.log(linkData, "linkData here");
      const sdsLink = linkData?.link;

      if (!sdsLink) {
        throw new Error("No SDS link returned");
      }

      let updated = false;

      // Step 3: If metafield exists → update it
      if (metafieldKeys.includes(metafieldKey)) {
         metaField =true ;
         
         
         console.log("Metafield exists, updating it...");
        const metafieldMutation = {
          query: `
            mutation {
              metafieldsSet(metafields: [
                {
                  key: "${metafieldKey}",
                  namespace: "custom",
                  ownerId: "gid://shopify/Product/${product_id}",
                  type: "url",
                  value: "${sdsLink}"
                }
              ]) {
                metafields {
                  id
                  key
                  value
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
        };

        const metafieldSetRes = await axios.post(
          `https://${session.shop}/admin/api/2023-10/graphql.json`,
          JSON.stringify(metafieldMutation),
          {
            headers: {
              "X-Shopify-Access-Token": session.accessToken,
              "Content-Type": "application/json",
            },
          }
        );

        //console.log("Metafield Update Response:", metafieldSetRes.data);
        updated = true;
      }

      // Step 4: If metafield not found → update product description
      if (!updated) {
        const htmlString = `${descriptionData} <br><a href="${sdsLink}" target="_blank">Safety Data Sheet</a>`;

        const productUpdateRes = await axios.put(
          `https://${session.shop}/admin/api/2025-01/products/${product_id}.json`,
          {
            product: {
              id: product_id,
              body_html: htmlString,
            },
          },
          {
            headers: {
              "X-Shopify-Access-Token": session.accessToken,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Product Description Updated");
      }

      // Step 5: Save product info into your DB
      const productRes = await axios.get(
        `https://${session.shop}/admin/api/2025-01/products/${product_id}.json`,
        {
          headers: {
            "X-Shopify-Access-Token": session.accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      const { id, title } = productRes.data.product;

      const checkresult = await prisma.allProducts.upsert({
        where: {
          productId_shop: {
            productId: id.toString(),
            shop: session.shop,
          },
        },
        update: {
          title,
          status: "updated",
          updatedAt: new Date(),
        },
        create: {
          productId: id.toString(),
          shop: session.shop,
          title,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });


      //console.log(checkresult, 'checkresult')
      if(checkresult){
        return json({
          message: 'Product updated successfully',
          metaField: metaField,
          productName:title,
          status:201,
        })
      }


     

    } catch (err) {
     // console.error("shopify error", err);
      return {
        message: "Something went wrong during the product update.",
        status: 500,
      };
    }
  }

}
  
export default function StoreData() {
  const { data, total, product_id, productInf, session ,product_code  ,messagefornoproduct} = useLoaderData();
  //console.log("dataStoreData",data);
  const actionRes = useActionData();
  const navigation = useNavigation();
  const productBodyhtml = productInf?.product?.body_html ;
  const [isPopupOpen, setPopupOpen] = useState(false);
  const [isLoading, setisLoading] = useState(false);

  const [itemData, setItemData] = useState("");
  const [descriptionData, setDescriptionData] = useState("");
  const [searchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page_index")) || 0;
  const pageSize = Number(searchParams.get("page_size")) || 10;
  const [open, setOpen] = useState('')

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
        setOpen('success');
      } else {
        setOpen('error');
      }
  
      const timer = setTimeout(() => {
        setOpen(null); // or false, depending on how you're handling the open state
      }, 5000);
  
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
  const [selectedNewId ,setSelectedNewId ] = useState(null)
  const handleClick = ( index , selectId) => {
    setClickedIndex(index);
    setSelectedNewId(selectId)

  };
  return (
    <>
      <Form method='PUT' >
      <div className={styles.container}>
  {/* Table with conditional rendering for data */}
  {messagefornoproduct && (
  <p className={styles.paragraph}>
    <span className={styles.span_class}>{messagefornoproduct.search_string}</span> {messagefornoproduct.text}
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
            {item?.sds_pdf_product_name || 'No Name Available'}
          </td>
          <td>{item?.sds_pdf_manufacture_name || ''}</td>
          <td>{item?.product_code || ''}</td>
          <td>{item?.regulation_area}</td>
          <td>{item?.language || ''}</td>
          <td>{item?.master_date || ''}</td>

          <td>
            <form onSubmit={(e) => handleClick(e, index, item?.search_id)}>
              {/* Hidden Inputs */}
              <input type="hidden" name="customer_id" value={1865} />
              <input 
                type="hidden" 
                name="new_id" 
                value={selectedNewId || item?.search_id || 0} 
                data-display-value={item?.search_id} 
              />
              <input type="hidden" name="product_id" value={product_id} />
              <input type="hidden" name="ravinder" value={productBodyhtml} />

              {/* Submit Button */}
              <button
                type="submit"
                name="productInf"
                value={productBodyhtml}
                className={styles.actionButton}
              >
                {navigation.state === 'submitting' && clickedIndex === index
                  ? 'Adding info...'
                  : 'Add'}
              </button>
            </form>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
) : (
  <p>No data available</p>
)}



{open === "success" && (
  <div style={{
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#f9f9f9',
    padding: '40px 30px',
    borderRadius: '20px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    maxWidth: '90%',
    width: '400px',
    textAlign: 'center',
  }}>
    <h2 style={{ marginBottom: '15px', fontSize: '22px', color: '#2c3e50' }}>
      ✅ Success!
    </h2>
    <p style={{ fontSize: '18px', color: '#34495e', lineHeight: '1.5' }}>
    Safety Data Sheet link is added to product <strong>{productInf?.product?.title}</strong>
    has been added to the product description field<br />
      <strong>PS: You can set up a meta field to have the link show as a separate link outside of the product descrilption"</strong>
    </p>
  </div>
)}

{open === "error" && (
  <div style={{
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#f9f9f9',
    padding: '40px 30px',
    borderRadius: '20px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    maxWidth: '90%',
    width: '400px',
    textAlign: 'center',
  }}>
    <h2 style={{ marginBottom: '15px', fontSize: '22px', color: '#2c3e50' }}>
      ✅ Success!
    </h2>
    <p style={{ fontSize: '18px', color: '#34495e', lineHeight: '1.5' }}>
    Safety Data Sheet link is added to product <stong>{productInf?.product?.title}</stong><br/>
      <strong>Go and check in the product.</strong>
    </p>
  </div>
)}




  {/* Pagination Section */}
  <div className={styles.pagination}>
    <button 
      className={`${styles.paginationButton} ${!canPageBackwards ? styles.disabled : ''}`} 
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
      className={`${styles.paginationButton} ${!canPageBackwards ? styles.disabled : ''}`} 
      disabled={!canPageBackwards}
    >
      <Link
        to={setSearchParamsString(searchParams, { page_index: Math.max(currentPage - 1, 0) })}
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
        className={`${styles.paginationButton} ${pageNumber === currentPage ? styles.active : ''}`} 
        disabled={pageNumber === currentPage}
      >
        <Link
          to={setSearchParamsString(searchParams, { page_index: pageNumber })}
          preventScrollReset
          prefetch="intent"
          className="px-3 py-1 rounded-md"
        >
          {pageNumber}
        </Link>
      </button>
    ))}

    <button 
      className={`${styles.paginationButton} ${!canPageForwards ? styles.disabled : ''}`} 
      disabled={!canPageForwards}
    >
      <Link
        to={setSearchParamsString(searchParams, { page_index: currentPage + 1 })}
        preventScrollReset
        prefetch="intent"
        className="text-neutral-600"
      >
        Next
      </Link>
    </button>

    <button 
      className={`${styles.paginationButton} ${!canPageForwards ? styles.disabled : ''}`} 
      disabled={!canPageForwards}
    >
      <Link
        to={setSearchParamsString(searchParams, { page_index: lastPageIndex })}
        preventScrollReset
        prefetch="intent"
        className="text-neutral-600"
      >
        Last
      </Link>
    </button>
  </div>
</div>

      </Form>
     
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
    product_code,
  } = searchParams;

  const accesTokenThirdParty = await getTokenThirdParty(session);
 // console.log(accesTokenThirdParty, "accesTokenfetchProducts");

  const apiUrl = `${process.env.API_URL_SEARCH}/?page_size=${page_size}&page=${page_index}`;
  const apiKey = process.env["X_Sds_Search_Access_Api_Key"];

  const createRequestBody = (search_type) => ({
    search: search_string,
    language_code: language_code,
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
     // console.log(secondData, "secondData");

     const data =  {search_string,text: "did not match any SDS in our database.", text1:" Showing similar results."}
      return {
        results: Array.isArray(secondData) ? secondData : [],
        message: data
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
async function fetchPermanentLink({ customer_id, sdspdf_id, product_id ,session}) {
const accesToken =  await  getTokenThirdParty(session);
console.log(accesToken, "accesTokenfetchPermanentLink")



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

async function fetchLinkOfPdf( id, pdf_md5) {

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
  const shopName = await session?.shop; // Renaming variable for clarity
  const token = await prisma.apiToken.findFirst({
    where: {
      shop: shopName, // Use shopName variable dynamically
    },
  });

  if (!token) {
    throw new Error("Token not found in the database");
  } else {
    const userName = token?.passwordapi; // Corrected the variable reference
    const password = token?.usernameapi; // Corrected the variable reference
    const apiUrl = process.env.API_URL; // API URL from environment variable

    let formData = new FormData();
    formData.append('username', userName); // Dynamically using userName from token
    formData.append('password', password); // Dynamically using password from token
  
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${apiUrl}/auth/token/`, // Assuming the URL should be dynamic based on the API URL
      data: formData, // Sending the formData as request body
    };

    try {
      const response = await axios.request(config);
      return response.data; // Log the response data
    } catch (error) {
      console.error("Error during API request:", error);
    }
  }
}
