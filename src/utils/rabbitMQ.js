const amqp = require('amqplib');

let channel = null;

async function connectRabbitMQ() {
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

module.exports = { connectRabbitMQ };
