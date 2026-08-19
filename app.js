const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json'); 

const app = express();
app.use(express.json());
const PORT =3000;
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/",(req,res)=>{
    res.send({ "name": "Task API", "version": "1.0", "endpoints": ["/tasks"] })
})
app.get("/health",(req,res)=>{
    res.send({status: "ok"})
})

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});