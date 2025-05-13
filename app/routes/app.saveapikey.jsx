import { Form, redirect, json, useLoaderData, useActionData } from '@remix-run/react';
import axios from 'axios';
import React, { useState } from 'react';
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
      return redirect('/app'); 
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
  return (
    <div className={styles.container}>
        <Form method="POST">
          <label>API KEY :
            <input type="text" name="api" required />
          </label>
          <button type="submit">Submit</button>
        </Form>
    </div>
  );
}
