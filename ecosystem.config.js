module.exports = {
    apps: [
	      {
                 name: 'MATTER_MINER_CALENDAR_APP',
	         script: 'src/server.js',
		 exec_mode: 'fork',
	         instances: '1', 
		 interpreter: 'node',
                 max_memory_restart: '256M',
	         merge_logs: true,
                 env: {
		     NODE_ENV: 'development',
		 },
                 env_production: {
		     NODE_ENV: 'production',
	         },
	       },
           ],
};
