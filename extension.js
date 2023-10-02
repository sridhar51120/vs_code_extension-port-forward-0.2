const vscode = require('vscode');
const net = require('net');
// we can use the inbuild methods in vscode in Js
// const {
// 	ExtensionContext,
// 	StatusBarAlignment,
// 	window,
// 	StatusBarItem,
// 	Selection,
// 	workspace,
// 	TextEditor,
// 	commands,
// 	ProgressLocation
// } = vscode;

/**
 * @param {vscode.ExtensionContext} context
 */

async function forwardPortWithProgress(sourcePort, sourceHost, destinationPort, destinationHost, startTime) {
	const totalSteps = 100;
	const progressTitle = 'Port Forwarding Progress';
	const progressMessage = 'Forwarding traffic...';
	console.log(`Port Forwarding starts --> HostName : ${destinationHost} and Port Number : ${destinationPort}`);
	console.log("Port Forwarding Progress Starts")
	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: progressTitle,
		cancellable: true,
	}, async (progress, token) => {
		progress.report({ increment: 0, message: progressMessage });

		try {
			const server = net.createServer((sourceSocket) => {
				console.time("Line 1");
				const destinationSocket = net.connect(destinationPort, destinationHost, () => {
					sourceSocket.pipe(destinationSocket);
					destinationSocket.pipe(sourceSocket);
					console.log(`Forward data from HostName : ${sourceHost} and PortNumber : ${sourcePort} to localhost:${destinationPort}`);
				});
				console.timeEnd("Line 1");

				sourceSocket.on('error', (err) => {
					console.error('Source socket error:', err);
				});

				destinationSocket.on('error', (err) => {
					console.error('Destination socket error:', err);
				});
				sourceSocket.on('end', () => {
					destinationSocket.end();
				});
				console.time("Line 1");
				destinationSocket.on('end', () => {
					sourceSocket.end();
				});
				console.timeEnd("Line 1");
			});
			server.listen(sourcePort, () => {
				console.log(`Port forwarding server is listening on port ${sourcePort}`);
				const endTime = new Date();
				const elapsedTime = endTime - startTime;
				console.log(`Time taken to finish the process = ${elapsedTime} milliseconds`);
			});
			for (let step = 0; step < totalSteps; step++) {
				if (token.isCancellationRequested) {
					vscode.window.showInformationMessage('Port Forwarding was canceled.');
					break;
				}

				const increment = 100 / totalSteps;

				progress.report({ increment, message: progressMessage });

				await new Promise((resolve) => setTimeout(resolve, 100));
				// console.log(step)
				if (step === 99) {
					vscode.window.showInformationMessage(`Port is Forwared to Hostname : ${destinationHost} and PortName : ${destinationPort}`);
				}
			}
			return true;
		} catch (error) {
			vscode.window.showErrorMessage('Port Forwarding encountered an error: ' + error.message);
			return false;
		}
	});
	return true;
}

function getWebviewContent(tableRows) {
	const template = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Port Forward</title>
            <style>
                table {
                    border-collapse: collapse;
                    width: 100%;
                }
                th, td {
                    border: 1px solid #dddddd;
                    text-align: left;
                    padding: 8px;
                }
            </style>
        </head>
        <body>
            <h1>Port Forward</h1>
            <table>
                <tr>
                    <th>Source Host</th>
                    <th>Source Port</th>
					<th>Destination Host</th>
                    <th>Destination Port</th>
					<th>Status</th>
                </tr>
                ${tableRows}
            </table>
        </body>
        </html>
    `;

	return template;
}
function createPanel(userDetails) {
	const panel = vscode.window.createWebviewPanel(
		'Port Forward',
		'Port Forwared Details',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
		}
	);

	const tableRows = userDetails.map((detail) => `
        <tr>
            <td>${detail.hostname}</td>
            <td>${detail.port}</td>
			<td>${detail.hostname}</td>
            <td>${detail.port}</td>
			<td>Alive </td>
        </tr>
    `).join('');
	panel.webview.html = getWebviewContent(tableRows);
	return panel;
}
// Showing the Port Details so collect the Port details From Config File from Vs code Workspace
const statusBarPortDetails = [];
const data = {
	"hostname": 'localhost',
	"port": 500,
	"action": 'add'
}
statusBarPortDetails.push(data);

function UserAction(inputString, startString, endString) {
	const startIndex = inputString.indexOf(startString);
	const endIndex = inputString.indexOf(endString, startIndex + startString.length);

	if (startIndex !== -1 && endIndex !== -1) {
		return inputString.substring(startIndex + startString.length, endIndex);
	} else {
		return null;
	}
}

function checkInputFormat(inputString, char1, char2) {
	return inputString.includes(char1) && inputString.includes(char2);
}

function isPortInUse(port) {
	return new Promise((resolve) => {
		const server = net.createServer()
			.once('error', (err) => {
				if (err.code === 'EADDRINUSE') {
					resolve(true); // Port is in use
				} else {
					resolve(false); // Other error
				}
			})
			.once('listening', () => {
				server.close();
				resolve(false); // Port is not in use
			})
			.listen(port, '127.0.0.1');
	});
}

function activate(context) {
	if (statusBarPortDetails === undefined) {
		vscode.window.showInformationMessage("None of the Ports are Assigned..\nAdd Ports and Try again..")
	} else {
		const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
		statusBarItem.text = "Port Forward - Dsscv";
		statusBarItem.tooltip = "Click to view Assigned Ports";
		statusBarItem.command = "luminous-fortune-port-forward.status-bar";
		statusBarItem.show();
	}

	vscode.commands.registerCommand('luminous-fortune-port-forward.status-bar', () => {
		const panel = createPanel(statusBarPortDetails);
		panel.reveal(vscode.ViewColumn.One);
	});

	context.subscriptions.push(vscode.commands.registerCommand(
		"luminous-fortune-port-forward.port-forward",
		async function () {
			const userInput = await vscode.window.showInputBox({
				prompt: 'Enter source Port Number or source Host Name with Port Number : ',
				placeHolder: 'Enter here...',
			});
			const startTime = new Date();
			const extensionConfigDetails = vscode.workspace.getConfiguration('luminous-fortune-port-forward');

			// for chacking only port is given
			const PortOnly = userInput.split(":");

			if ((typeof userInput === "string") && checkInputFormat(userInput, ':', '/')) {
				// vscode.window.showInformationMessage("Success");
				const hostName = UserAction(userInput, "", ":");
				const portNumber = UserAction(userInput, ":", "/");
				const userAction = userInput.split("/")[1]
				console.log(`The Process starts at [ ${startTime}]`)
				console.log(`User Action : ${userAction}`)
				console.log(`HostName : ${hostName}`);
				console.log(`PortNumber : ${portNumber}`);
				const data = {
					"hostname": hostName,
					"port": portNumber,
					"action": userAction
				}
				if (portNumber >= 1 && portNumber <= 65535) {
					if (userAction == 'add') {
						isPortInUse(portNumber)
							.then((inUse) => {
								if (inUse) {
									vscode.window.showErrorMessage("Port is already Allocated...");
								} else {
									const infoPortDetails = `HostName : ${hostName}\nPortName : ${portNumber}`;
									// vscode.window.showInformationMessage("Port is Not Available");
									console.log(`Initiating Port forwarding Task....`)
									console.log(`${infoPortDetails}`)
									vscode.window.showWarningMessage(
										`Shall I start the port forwarding action?\n${infoPortDetails}`,
										'Yes', 'No'
									)
										.then((selectedAction) => {
											// add the port details to VS Code Configuration file
											if (selectedAction === 'Yes') {
												const portDetails = extensionConfigDetails.get('PortDetails', []);
												// console.log(`Data : ${data}`)
												portDetails.push(data);
												// // Update the configuration with the modified array
												extensionConfigDetails.update('PortDetails', portDetails, vscode.ConfigurationTarget.Global);
												// console.log(`Added : ${data}`);
												// forwardPortWithProgress(sourcePort, destinationPort, destinationHost)
												forwardPortWithProgress(portNumber, hostName, portNumber, 'localhost', startTime)
												// Calculate the Port Details to show,when the Status Icon is Clicked 
												portDetails.forEach(portdetail => {
													statusBarPortDetails.push(portdetail)
												});
												// console.log(`Status bar ${statusBarPortDetails}`)
											}
											else if (selectedAction === 'No') {
												vscode.window.showInformationMessage('Port Forward tesk was Cancelled by the User...');
											}
										})
								}
							})
							.catch((error) => {
								vscode.window.showErrorMessage(`Error checking port: ${error.message}`);
							});
					}
					else if (userAction == 'remove') {
						vscode.window
							.showWarningMessage(
								'Shall I Remove the Port Details',
								'Remove', 'Cancel'
							)
							.then((selectedAction) => {
								if (selectedAction === 'Remove') {
									console.log("Exclude the information from the Configuration file.");
									console.log(`Removed Details\n`)
									console.log(`HostName : ${hostName}\n`)
									console.log(`Port Number : ${portNumber}`)
									const portDetails = extensionConfigDetails.get('PortDetails');
									// Remove the selected value from the array
									const updatedValues = portDetails.filter((value) => value !== data);
									// Update the configuration with the modified array
									extensionConfigDetails.update('PortDetails', updatedValues, vscode.ConfigurationTarget.Global);
									vscode.window.showInformationMessage(`Exclude the information from the Configuration file.\nHostname : ${hostName} and Port Number : ${portNumber}`);
									console.log("Process Completed\n")
									// portDetails.forEach((portDetail) => {
									// 	console.log(`details : ${portDetail}`);
									// });
								} else if (selectedAction === 'Cancel') {
									vscode.window.showInformationMessage('Remove the Port Details task was cancelled by the User...');
								}
							})
					}
					else {
						vscode.window.showErrorMessage("Invalid User Operation.. /nPlease try Add (or) remove => Operations")
					}
				} else {
					vscode.window.showErrorMessage("Invalid Port Number... Chack your Input Port Number...")
				}

			}
			else if ((PortOnly.length === 2) && (typeof Number(PortOnly[0]) === "number")) {
				// vscode.window.showInformationMessage(`Port Only : ${PortOnly[0]} and ${PortOnly[1]}`);
				const portNumber = Number(PortOnly[0])
				const userAction = PortOnly[1]
				const hostName = '127.0.0.1'
				console.log(`The Process starts at [ ${startTime}]`)
				console.log(`User Action : ${userAction}`)
				console.log(`HostName : ${hostName}`);
				console.log(`PortNumber : ${portNumber}`);
				const data = {
					"hostname": hostName,
					"port": portNumber,
					"action": userAction
				}
				if (portNumber >= 1 && portNumber <= 65535) {
					if (userAction == 'add') {
						isPortInUse(portNumber)
							.then((inUse) => {
								if (inUse) {
									vscode.window.showErrorMessage("Port is already Allocated...");
								} else {
									const infoPortDetails = `HostName : ${hostName}\nPortName : ${portNumber}`;
									// vscode.window.showInformationMessage("Port is Not Available");
									console.log(`Initiating Port forwarding Task....`)
									console.log(`${infoPortDetails}`)
									vscode.window.showWarningMessage(
										`Shall I start the port forwarding action?\n${infoPortDetails}`,
										'Yes', 'No'
									)
										.then((selectedAction) => {
											// add the port details to VS Code Configuration file
											if (selectedAction === 'Yes') {
												const portDetails = extensionConfigDetails.get('PortDetails', []);
												// console.log(`Data : ${data}`)
												portDetails.push(data);
												// // Update the configuration with the modified array
												extensionConfigDetails.update('PortDetails', portDetails, vscode.ConfigurationTarget.Global);
												// forwardPortWithProgress(sourcePort, destinationPort, destinationHost)
												forwardPortWithProgress(portNumber, hostName, portNumber, 'localhost', startTime)
												// Calculate the Port Details to show,when the Status Icon is Clicked 
												portDetails.forEach(portdetail => {
													statusBarPortDetails.push(portdetail)
												});
												// console.log(`Status bar ${statusBarPortDetails}`)
											}
											else if (selectedAction === 'No') {
												vscode.window.showInformationMessage('Port Forward tesk was Cancelled by the User...');
											}
										})
								}
							})
							.catch((error) => {
								vscode.window.showErrorMessage(`Error checking port: ${error.message}`);
							});
					}
					else if (userAction == 'remove') {
						vscode.window
							.showWarningMessage(
								'Shall I Remove the Port Details',
								'Remove', 'Cancel'
							)
							.then((selectedAction) => {
								if (selectedAction === 'Remove') {
									console.log("Exclude the information from the Configuration file.");
									console.log(`Removed Details\n`)
									console.log(`HostName : ${hostName}\n`)
									console.log(`Port Number : ${portNumber}`)
									const portDetails = extensionConfigDetails.get('PortDetails');
									// Remove the selected value from the array
									const updatedValues = portDetails.filter((value) => value !== data);
									// Update the configuration with the modified array
									extensionConfigDetails.update('PortDetails', updatedValues, vscode.ConfigurationTarget.Global);
									vscode.window.showInformationMessage(`Exclude the information from the Configuration file.\nHostname : ${hostName} and Port Number : ${portNumber}`);
									console.log("Process Completed\n")
								} else if (selectedAction === 'Cancel') {
									vscode.window.showInformationMessage('Remove the Port Details task was cancelled by the User...');
								}
							})
					}
					else {
						vscode.window.showErrorMessage("Invalid User Operation.. /nPlease try add (or) remove => Operations")
					}
				} else {
					vscode.window.showErrorMessage("Invalid Port Number... Chack your Input Port Number...")
				}
			} else {
				vscode.window.showErrorMessage("Invalid Input values...");
			}

		}
	)
	)

	vscode.extensions.onDidChange(() => {
		if (statusBarPortDetails === undefined) {
			return;
		} else {
			// forwardPortWithProgress(sourcePort, sourceHost, destinationPort, destinationHost, startTime)
			const startTime = new Date();
			// Dafultly Run the Previous Configuration files (or) Existing Congfigured Port detatils
			async function processPorts() {
				for (const portDetails of statusBarPortDetails) {
					const [hostName, portNumber, userAction] = portDetails;
					await forwardPortWithProgress(
						portNumber,
						hostName,
						portNumber,
						hostName,
						startTime
					);
				}
			}

			processPorts()
				.then(() => {
					console.log('All ports processed successfully.');
					const endTime = new Date();
					const totalTime = endTime - startTime;
					console.log(`Total time taken: ${totalTime} ms`);
				})
				.catch((error) => {
					console.error('Error processing ports:', error);
				});
		}
	});
}


exports.activate = activate

function deactivate() { }

module.exports = {
	activate,
	deactivate,
}
