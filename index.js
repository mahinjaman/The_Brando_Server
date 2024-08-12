require('dotenv').config();
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000;
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
// middleware

app.use(cors({
    credentials: true,
    origin: ['http://localhost:5173', 'http://localhost:5174']
    // origin: ['https://the-brando.web.app', 'https://console.firebase.google.com/project/the-brando/overview']
}))
app.use(express.json())
app.use(cookieParser())

// My Middleware

const verifyUser = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'UnAuthorized' })
    }

    jwt.verify(token, process.env.SECURITY_JWT_TOKEN, (error, decode) => {
        if (error) return res.status(403).json({ message: 'Access denied. Invalid token.' });
        req.user = decode;
        next();
    })
}

// routes

app.get('/', (req, res) => {
    res.send('Hello Brando Your server is ready to serve')
})


// Mongodb 


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const e = require('express');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oqwbmox.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {

    const roomsCollections = client.db('TheBrando').collection('rooms');
    const roomsFacilityCollections = client.db('TheBrando').collection('room_facility');
    const latestNewsCollections = client.db('TheBrando').collection('news');
    const testimonialsCollections = client.db('TheBrando').collection('testimonial');
    const restaurantCollections = client.db('TheBrando').collection('restaurant_menu');
    const bookingCollections = client.db('TheBrando').collection('booking');
    const userCollections = client.db('TheBrando').collection('users');

    try {


        // JWT Verify

        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECURITY_JWT_TOKEN, {
                expiresIn: '1hr'
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'none'
                })
                .send({ success: true });
        })


        // get popular rooms

        app.get('/popular_rooms', async (req, res) => {
            const popularRooms = await roomsCollections.find()
                .limit(5)
                .toArray();
            res.send(popularRooms)
        })

        // get rooms from mongo_db

        app.get('/rooms', async (req, res) => {
            const page =  parseInt(req.query.page);
            const limit = parseInt(req.query.limit);
            const skip = (page - 1) * limit;
            const rooms = await roomsCollections.find()
                .skip(skip)
                .limit(limit)
                .toArray()
            res.send(rooms)
        })

        // get room facility from mongo_db
        app.get('/room_facility', async (req, res) => {
            const roomFacility = await roomsFacilityCollections.find().toArray();
            res.send(roomFacility)
        })

        // get news room mongodb

        app.get('/news', async (req, res) => {
            const latestNews = await latestNewsCollections.find().toArray();
            res.send(latestNews)
        })

        // get testimonials
        app.get('/testimonials', async (req, res) => {
            const testimonials = await testimonialsCollections.find().toArray();
            res.send(testimonials)
        })


        // get specific room
        app.get('/room/:id', verifyUser, async (req, res) => {
            // if(req.user != process.env.SECURITY_JWT_TOKEN){
            //     return res.status(403).send({ message: 'Access denied. Invalid token.' });
            // }
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await roomsCollections.findOne(query)
            res.send(result)
        })

        // get total_room count from mongodb
        app.get('/total_rooms', async (req, res) => {
            const count = await roomsCollections.countDocuments();
            res.send({ count })
        })

        // get restaurant menu
        app.get('/restaurant_menu', async (req, res) => {
            const restaurantMenu = await restaurantCollections.find().toArray()
            res.send(restaurantMenu)
        })

        // get search room 



        // Clear cookie
        app.post('/log_out', async (req, res) => {
            res.clearCookie('token');
            res.send({ success: true });
        })

        // room booking request

        app.post('/booking', async (req, res) => {
            const room = await req.body;
            const result = await bookingCollections.insertOne(room);
            res.send(result);
        })

        // get booking rooms for the current user

        app.get('/booking', verifyUser, async (req, res) => {
            const currentUser = req?.user;
            
            if (currentUser?.email != req.query.email) {
                res.status(403).send({ message: 'Access denied. Invalid token.' });
            }
            let query = {};
            if (req.query?.email) {
                query = { email: req.query?.email , orderStatus:{$ne:'Cancelled'}}
            }

            const result = await bookingCollections.find(query).toArray()
            res.send(result)

        })

        // update booking status confirmed

        app.patch('/bookingStatus/:id', async (req, res) => {
            const id = req.params.id;            
            const query = { _id: new ObjectId(id) }
            const orderStatus = req.query?.status;
            const updateStatus = {
                $set: { orderStatus }
            }
            const updateResult = await bookingCollections.updateOne(query, updateStatus);
            res.send(updateResult)
        })


        // update booking room status cancelled
        app.put('/booking_cancelled/:id', verifyUser, async (req, res) => {
            const currentUser = req.body;
            const id = req.params.id;

            if (currentUser?.email != req.query?.email) {
                res.status(403).send({ message: 'Access denied. Invalid token.' });
            }

            const orderStatus = req.query?.status;
            const filter = { _id: new ObjectId(id) };
            const updateStatus = {
                $set: { orderStatus }
            }

            const updateResult = await bookingCollections.updateOne(filter, updateStatus);
            res.send(updateResult);


        });

        // Room Status Update Available

        app.patch('/room_status/:id', async (req, res) => {
            const id = req.params?.id;
            const roomFilter = { _id: new ObjectId(id) };
            const status = req.query.status;
            
            const roomUpdateStatus = {
                $set: { status }
            }
            const roomUpdateResult = await roomsCollections.updateOne(roomFilter, roomUpdateStatus);
            return res.send(roomUpdateResult)
        })

        // get all bookings room
        app.get('/all_bookings', async (req, res) => {
            const result = await bookingCollections.find().toArray()
            res.send(result)
        })

        // Users Collections

        app.post('/users', async (req, res) => {
            const user = req.body;
            const email = req.body.email;
            const query = { email };
            const userExist = await userCollections.findOne(query);
            if (userExist) {
                return res.status(400).send({ message: 'User already exists' });
            }
            const result = await userCollections.insertOne(user);
            res.send(result);
        })

        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir);



// End Mongo Db




app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})