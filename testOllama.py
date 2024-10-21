import streamlit as st
import ollama

st.title("OLLAMA")
prompt = st.text_area(label="write your imput")
button = st.button("OKAY")

if button:
    if prompt:
        response = ollama.generate(model='llama3.2', prompt=prompt)
        st.markdown(response["response"])