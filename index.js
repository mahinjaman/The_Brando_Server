require('dotenv').config();
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000;
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
// middleware

app.use(cors({
    credentials: true,
    // origin: ['http://localhost:5173', 'http://localhost:5174']
    origin: ['https://the-brando.web.app', 'https://console.firebase.google.com/project/the-brando/overview']
}))
app.use(express.json())
app.use(cookieParser())

// My Middleware

const verifyUser = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'UnAuthorized' })
    }

    jwt.verify(token, process.env.SECURITY_JWT_TOKEN, (error, decoded) => {
        if (error) return res.status(403).json({ message: 'Access denied. Invalid token.' });
        req.user = decoded;
        next();
    })
}








// routes

app.get('/', (req, res) => {
    res.send('Hello Brando Your server is ready to serve')
})


// Mongodb 


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const cartCollections = client.db('TheBrando').collection('carts');
    const userCollections = client.db('TheBrando').collection('users');
    const paymentCollections = client.db('TheBrando').collection('payments');
    const bookingsCollections = client.db('TheBrando').collection('bookings');


    const verifyAdmin = async (req, res, next) => {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).send({ message: 'Unauthorized' })
        }
        const email = req.user?.email;
        const query = { email }
        const currentUser = await userCollections.findOne(query)
        if (!currentUser) {
            return res.status(403).send({ message: 'Access denied. You are not an admin.' });
        }
        if (currentUser.role !== 'Admin') {
            return res.status(403).send({ message: 'Access denied. You are not an admin.' });
        }
        next()
    }

    try {

        // ------------------post related Api --------------------------------

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



        // post new room
        app.post('/room', verifyUser, verifyAdmin, async (req, res) => {
            const room = req.body;
            const result = await roomsCollections.insertOne(room);
            res.send(result);

        })


        // Users Collections

        // post new user
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


        // room cart request

        app.post('/cart', async (req, res) => {
            const room = await req.body;
            const result = await cartCollections.insertOne(room);
            res.send(result);
        })


        // Clear cookie
        app.post('/log_out', async (req, res) => {
            res.clearCookie('token');
            res.send({ success: true });
        })

        // ------------------ Payment Related --------------------------------

        app.post('/create-payment-intents', async (req, res) => {
            const { price } = req.body;

            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "usd",
            })
            res.send({ clientSecret: paymentIntent.client_secret })
        })

        // Payment list
        app.post('/payment', async (req, res) => {
            const { payment } = await req.body;
            const { confirmBookingRooms = [] } = await req.body;

            const result = await paymentCollections.insertOne(payment);

            const query = {
                _id: {
                    $in: payment?.cart_ids.map(id=> new ObjectId(id))
                }
            };


            const updateStatus = {
                $set: { status: 'Booking' }
            }


            const roomUpdateQuery = {_id: { $in: payment?.room_ids.map(id=> new ObjectId(id))}}

            const deleteCarts = await cartCollections.deleteMany(query);

            const updateRooms = await roomsCollections.updateMany(roomUpdateQuery, updateStatus)

            

            confirmBookingRooms.map( async room =>{
                const bookingResult = await bookingsCollections.insertOne(room)
                
            })


            res.send(result);
        })


        // ------------------get related Api --------------------------------



        // get popular rooms

        app.get('/popular_rooms', async (req, res) => {
            const popularRooms = await roomsCollections.find()
                .limit(5)
                .toArray();
            res.send(popularRooms)
        })

        // get rooms from mongo_db

        app.get('/rooms', async (req, res) => {
            const page = parseInt(req.query.page);
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

        // get carts rooms for the current user

        app.get('/carts', verifyUser, async (req, res) => {
            const currentUser = req?.user;

            if (currentUser?.email != req.query.email) {
                res.status(403).send({ message: 'Access denied. Invalid token.' });
            }
            let query = {};
            if (req.query?.email) {
                query = { email: req.query?.email, orderStatus: { $ne: 'Cancelled' } }
            }

            const result = await cartCollections.find(query).toArray()
            res.send(result)

        })

        // get all carts room
        app.get('/all_carts', async (req, res) => {
            const result = await cartCollections.find().toArray()
            res.send(result)
        })



        // get the all users
        app.get('/users', verifyUser, verifyAdmin, async (req, res) => {
            const result = await userCollections.find().toArray()
            res.send(result)
        })

        // Get Is Admin User
        app.get('/is_admin/:email', verifyUser, async (req, res) => {
            const email = req.params.email;
            if (req.user.email !== email) {
                return res.status(403).send({ message: 'Access denied. Invalid token.' });
            }
            const user = await userCollections.findOne({ email });
            if (user?.role === 'Admin') {
                res.send({ isAdmin: true });
            }
            else {
                res.send({ isAdmin: false });
            }
        })

        // get payment list

        app.get('/payment-history/:email', verifyUser , async (req, res) => {
            const email = req.params.email;
            if(!email){
                return res.status(401).send({ message: 'Unauthorize Access..!' });
            }
            

            if(email !== req.user?.email){
                return res.status(403).send({ message: 'Access denied. Invalid token.' });
            }

            const query = {email}
            
            const result = await paymentCollections.find(query).toArray();
            res.send(result)
            
        })

        // get confirm booking rooms
        app.get('/confirm-booking/:email', verifyUser , async (req, res)=>{
            const email = req.params.email;
            
            if(!email){
                return res.status(401).send({ message: 'Unauthorize Access..!' });
            }
            if(email !== req.user.email){
                return res.status(403).send({ message: 'Access denied. Invalid token.' });
            }
            const query = { email : email};
            const result = await bookingsCollections.find(query).toArray();
            res.send(result)
        })

        // Only Use Administrator

        const admin_secret = process.env.ADMIN_SECRET_TOKEN;


        app.get('/all-bookings/:admin_secret' , async (req, res)=>{
            const adminSecret = req.params.admin_secret;
            if(adminSecret !==  admin_secret){
                return res.status(401).send({ message: 'Unauthorize Access..!' });
            }
            const result = await bookingsCollections.find().toArray();
            res.send(result)
        })


        // Get Admin States

        app.get('/admin-stats/:email', verifyUser, verifyAdmin, async (req, res)=>{

            if(req.params.email !== req.user.email){
                return res.status(403).send({ message: 'Access denied. Invalid token.' });
            }

            const totalRooms = await roomsCollections.estimatedDocumentCount();
            const totalUsers = await userCollections.estimatedDocumentCount();
            const totalBookings = await bookingsCollections.estimatedDocumentCount();
            const totalPayments = await paymentCollections.estimatedDocumentCount();
            // const totalRevenue = await paymentCollections.aggregate([
            //     {
            //         $group: {
            //         _id: null,
            //         totalRevenue: { $sum: "$amount" }
            //     }
            // }
            // ])

            const totalRevenueResult = await paymentCollections.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$amount" }
                    }
                }
            ]).toArray()

            const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0;


            res.send({
                totalRooms,
                totalUsers,
                totalBookings,
                totalPayments,
                totalRevenue
            })
        })

        // get payment stats

        app.get('/bookings-stats', verifyUser , verifyAdmin, async (req, res) => {

            try {
                const result = await paymentCollections.aggregate([
                    {
                        $unwind: '$room_ids'
                    },
                    {
                        $addFields: {
                            room_ids: { $toObjectId: "$room_ids" }
                        }
                    },
                    {
                        $lookup: {
                            from: 'rooms',
                            localField:'room_ids',
                            foreignField: "_id",
                            as: 'room'
                        }
                    },
                    {
                        $unwind: '$room' 
                    },
                    {
                        $group: {
                            _id: '$room.title',
                            totalBookings: { $sum: 1 },
                            totalRevenue: { $sum: '$amount' },
                        }
                    }
                ]).toArray();
        
                res.send(result);
            } catch (error) {
                console.error('Error fetching booking stats:', error);
                res.status(500).send({ error: 'An error occurred while fetching booking stats' });
            }
        });

        

        


        // ------------------patch and put related Api --------------------------------


        // update Cart status confirmed
        app.patch('/cartStatus/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const orderStatus = req.query?.status;
            const updateStatus = {
                $set: { orderStatus }
            }
            const updateResult = await cartCollections.updateOne(query, updateStatus);
            res.send(updateResult)
        })


        // update cart room status cancelled
        app.put('/cart_cancelled/:id', verifyUser, async (req, res) => {
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

            const updateResult = await cartCollections.updateOne(filter, updateStatus);
            res.send(updateResult);


        });



        // Room Status Update Available

        app.patch('/room_status/:id', async (req, res) => {
            const id = req.params?.id;
            const roomFilter = { _id: new ObjectId(id) };
            const status = await req.query.status;
            const roomUpdateStatus = {
                $set: { status }
            }
            const roomUpdateResult = await roomsCollections.updateOne(roomFilter, roomUpdateStatus);
            return res.send(roomUpdateResult)
        })



        // update user role 
        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const role = req.query?.role;
            const updateRole = {
                $set: { role }
            }
            const updateResult = await userCollections.updateOne(query, updateRole);
            res.send(updateResult)
        })

        // Update Booking Status 

        app.patch(`/update-bookings/:id`, async (req, res) => {
            const id = req.params.id;
            const status = req.query.status;
            const filter = {_id: new ObjectId(id)}
            const updateStatus = {
                $set: { status }
            }

            const updateResult = await bookingsCollections.updateOne(filter, updateStatus)

            res.send(updateResult);
        })




        // ------------------delete related Api --------------------------------

        // delete specific room
        app.delete('/delete_room/:id', verifyUser, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const deleteResult = await roomsCollections.deleteOne(query);
            res.send(deleteResult);
        })

        // delete user
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const deleteResult = await userCollections.deleteOne(query);
            res.send(deleteResult);
        })

        // delete cart
        app.delete('/cart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const deleteResult = await cartCollections.deleteOne(query);
            res.send(deleteResult);
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