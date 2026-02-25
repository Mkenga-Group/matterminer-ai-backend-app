const amqp = require('amqplib');

let channel = null;
let connection = null;

async function connectRabbitMQ_OLD() {
   if (channel) return channel;
   try {
	const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
	channel = await connection.createChannel();
        await channel.assertQueue('calendar_sync', { durable: true });
	console.log('Connected to RabbitMQ');
        return channel;
   } catch (error) {
	console.error('RabbitMQ Connection Error:', error);
	return null;
   }
}

async function connectRabbitMQ() {
    // 1. If channel already exists and is healthy, return it
    if (channel) return channel;

    const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

    try {
        // 2. Attempt Connection
        connection = await amqp.connect(RABBIT_URL);

        // 3. Handle Connection Closure/Errors
        connection.on('error', (err) => {
            console.error('RabbitMQ Connection Error:', err.message);
            channel = null; // Reset so next call tries to reconnect
        });

        connection.on('close', () => {
            console.warn('RabbitMQ Connection Closed. Retrying in 5s...');
            channel = null;
            setTimeout(connectRabbitMQ, 5000); // Auto-reconnect
        });

        // 4. Create and Setup Channel
        channel = await connection.createChannel();
        await channel.assertQueue('calendar_sync', { durable: true });

        console.log('Connected to RabbitMQ');
        return channel;

    } catch (error) {
        // 5. Specific check for the 403 Access Refused error
        if (error.message.includes('403')) {
            console.error('RabbitMQ AUTH FAILURE: Check username, password, or VHost permissions.');
        } else {
            console.error('RabbitMQ Initial Connection Failed:', error.message);
        }
        
        channel = null;
        return null;
    }
}

module.exports = { connectRabbitMQ };
