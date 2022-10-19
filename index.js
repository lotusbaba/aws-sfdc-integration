// dependencies
import aws from 'aws-sdk';
import util from 'util';
import fetch from 'node-fetch';
import nforce from 'nforce';

// get reference to S3 client
const s3 = new aws.S3();

export const handler = async (event, context, callback) => {

  // Read options from the event parameter.
  console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
  const srcBucket = "your-bucket-name";
  // Object key may have spaces or unicode non-ASCII characters.
    //   const srcKey    = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    const dstBucket = "your-bucket-name";
    const dstKey    = "your-object-name";


    // Upload the thumbnail image to the destination bucket
    try {
        const destparams = {
            Bucket: "your-bucket-name",
            Key: "your-object-name",
            Body: 'your-body',
        };

        const putResult = await s3.putObject(destparams).promise();

    } catch (error) {
        console.log(error);
        return;
    }

    console.log('Successfully created and uploaded to ' + dstBucket + '/' + dstKey);
    // return ('Successfully created and uploaded to ' + dstBucket + '/' + dstKey);
    
    // import getConnection from './sfdc_oauth.js';
    const client_id = 'SFDC Connected App Consumer Key'
    const client_secret = 'SFDC Connected App Consumer Secret'
    const redirect_uri = 'https://login.salesforce.com/services/oauth2/success'
    const sfdc_user = 'your@email'
    const sfdc_pass = 'your@pass'
    
    const credentials = {
        client_id :client_id,
        client_secret:client_secret,
        grant_type:"password",
        username:sfdc_user,
        password:sfdc_pass
    }

    async function getConnection(){
        const loginUrl = "https://login.salesforce.com/services/oauth2/token";
        
        var org = nforce.createConnection({
            clientId: credentials.client_id,
            clientSecret: credentials.client_secret,
            redirectUri: redirect_uri,
        });
        let oauth= await org.authenticate({ username: credentials.username, password: credentials.password});
        
        const access_token = oauth.access_token;
        const sf_auth_url = oauth.instance_url + '/services/data/v56.0/'
        
        
        const sf_auth = {
            'Authorization':'Bearer ' + access_token, 
            'Content-type': 'application/json',
            'Accept-Encoding': 'gzip'
        }
        return { sf_auth,sf_auth_url }
        
    }

    // Warming up
    let oauth = await getConnection();
    const query = `select Id, Name from Account`;
    let sf_auth_url =  oauth["sf_auth_url"]+'query?q='+query;
    let sf_auth_url_2 =  oauth["sf_auth_url"]+'sobjects/Case/listviews/00B4w00000BQU8xEAH/results';
    let result;
    result = await fetch(sf_auth_url_2, { method : 'GET', headers : {...oauth.sf_auth} })
        .then(res => res.json())
        .then(body=>{
            return body
        }).catch(err=>{
            console.log(err)
        });
    
    // Meat of where everything happens
    var myObj = [];
    for (const record_index in result.records) {
        console.log("Record number: " + record_index)

        for (const column_index in result.records[record_index].columns) {
            
            if (result.records[record_index].columns[column_index].fieldNameOrPath == 'Id') {
                console.log("I have the id");
                sf_auth_url_2 =  oauth["sf_auth_url"]+'sobjects/Case/'+result.records[record_index].columns[column_index].value;
                const new_result = await fetch(sf_auth_url_2, { method : 'GET', headers : {...oauth.sf_auth} })
                    .then(res => res.json())
                    .then(body=>{
                        myObj.push("case ID: " + body.Id + ", CaseNumber: "+body.CaseNumber + ", description: " + body.Description + ", subject: "+ body.Subject + ", Origin: " + body.Origin + ", Category: "+ body.category__c + ", RecordType: " + body.Type)
                        console.log("case ID: " + body.Id + ", CaseNumber: "+body.CaseNumber + ", description: " + body.Description + ", subject: "+ body.Subject + ", Origin: " + body.Origin + ", Category: "+ body.category__c + ", RecordType: " + body.Type)
                        
                    }).catch(err=>{
                        console.log(err)
                    });
            }
        }
    }
    var buf = Buffer.from(JSON.stringify(myObj));
    try {
        const destparams = {
            Bucket: "your-bucket",
            Key: "your-object-name",
            Body: buf,
            ContentEncoding: 'base64',
            'ContentType': 'application/json'
        };

        const putResult = await s3.putObject(destparams).promise();

    } catch (error) {
        console.log(error);
        return;
    }

    var new_recs = { Status : 'New', Description : '', Origin : '', category__c : 'pain point '+result.records.length, Subject: 'Coding quiz case - '+result.records.length, Type : 'Other'};

    sf_auth_url =  oauth["sf_auth_url"]+'sobjects/Case/'
    result = await fetch(sf_auth_url, { method : 'POST', body: JSON.stringify(new_recs), headers : {...oauth.sf_auth} })
            .then(res => res.json())
            .then(body=>{
                console.log (body)
            }).catch(err=>{
                console.log(err)
            });
    
    const response = {
        statusCode: 302,
        headers: {
            Location: 'https://your-bucket-name-west.s3.us-west-1.amazonaws.com/your-object-name',
        }
        };
    
        return callback(null, response);

};
            

