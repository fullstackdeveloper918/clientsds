import { Form, redirect, json, useLoaderData, useActionData, Link, useNavigate } from '@remix-run/react';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import styles from '../styles/style.module.css';
import FormData from 'form-data';
import prisma from '../db.server'; // Ensure Prisma is setup
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { admin, session } = await authenticate.admin(request);
    return { session };
  } catch (error) {
    console.error("Authentication error:", error);
    return json({ shop: null, message: "Please log in." });
  }
}

// Action function: Handle login submission
export async function action({ request }) {
  const formData = new FormData();
  const data = await request.formData();
  const apiKey = data.get('api');
  
  const { admin, session } = await authenticate.admin(request);

  // Validate email and password
  if (!apiKey) {
    return json({ error: "Api key is required" }, { status: 400 });
  }
  try {
    // Prepare the form data
      // Use upsert to either update or create the record based on the shop
      await prisma.apiToken.upsert({
        where: {shop :session.shop },
        update: {
          token :apiKey
        },
        create: { 
          shop:session.shop, 
          token :apiKey
        },
      });
      
      return {data: "success"}; 
  } catch (err) {
    console.error('sError saving key', err);
    // Handle errors during the request
    return json({ error: "An error occurred while processing your request." }, { status: 500 });
  }
}

// Login Form Component
export default function saveApiKey() {
  //const { session } = useLoaderData();
  
  const actionData = useActionData();  // To capture the error returned by the action
    const navigate = useNavigate();

  const [open, setOpen] = useState("");
  


useEffect(() => {
    if (actionData?.data === "success") {
      setOpen("success");

      setTimeout(()=>{
        navigate("/app")
        setOpen("");
       
      },2000)
    }
  }, [actionData]);
  console.log(actionData, "actionData");
  return (
   <div className={styles.container_key}>
  <Form method="POST" className={styles.form}>
    <div className={styles.formGroup}>
      <label htmlFor="api">API KEY</label>
      <input type="text" id="api" name="api" required className={styles.input} />
    </div>
    <button type="submit" className={styles.button}>Submit</button>
  </Form>

               {open === "success" && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "#f9f9f9",
              padding: "50px 40px",
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
         Your api key is saved successfully.
       
              
            </p>
   
          </div>
        )}

    </div>
  );
}
