-- Seed all conversations
INSERT OR IGNORE INTO conversation(id, user_id, title, is_archived, is_public, share_id)
VALUES
  ('conv_seed',    1, 'Seeded Conversation',                         0, 1, 'test_validation_seed'),
  ('conv_roles',   1, 'Roles Conversation',                          0, 1, 'test_validation_roles'),
  ('conv_platform',1, 'Platform Conversation',                       0, 1, 'test_validation_platform'),
  ('conv_mode',    1, 'Mode Conversation',                           0, 1, 'test_validation_mode'),
  ('conv_status',  1, 'Status Conversation',                         0, 1, 'test_validation_status'),
  ('conv_ts',      1, 'Timestamp Conversation',                      0, 1, 'test_validation_ts'),
  ('conv_threads', 1, 'Threads Conversation',                        0, 1, 'test_validation_threads'),
  ('conv_citations',1,'Citations Conversation',                      0, 1, 'test_validation_citations'),
  ('conv_attachments',1,'Attachments Conversation',                  0, 1, 'test_validation_attachments'),
  ('conv_search_grounding',1,'Search Grounding Conversation',           0, 1, 'test_validation_search_grounding'),
  ('conv_custom_xml_code',1,'Custom XML & Code Conversation',          0, 1, 'test_validation_custom_xml_code'),
  ('conv_analysis',1, 'Analysis Conversation',                       0, 1, 'test_validation_analysis'),
  ('conv_think',   1, 'Think Conversation',                          0, 1, 'test_validation_think'),
  ('conv_artifact',1, 'Artifact Conversation',                       0, 1, 'test_validation_artifact'),
  ('conv_external_function',1,'External Function Conversation',         0, 1, 'test_validation_external_function'),
  ('conv_search_grounding_full',1,'Full Search & Attachment Conversation',0, 1, 'test_validation_search_grounding_full'),
  ('conv_renderer',1, 'Response Renderer Conversation',              0, 1, 'test_validation_renderer'),
  ('conv_artifact_react',1,'Artifact React',         0, 1, 'test_validation_artifact_react');

-- Seed messages in conv_seed
INSERT INTO message(id, conversation_id, role, content, model)
VALUES
  ('msg_minimal','conv_seed','user','Hello minimal', 'gpt-4o'),
  ('msg_full',   'conv_seed','assistant','Hello full', 'gpt-4o');

-- Seed role variation messages
INSERT INTO message(id, conversation_id, role, content, model)
VALUES
  ('msg_role_user',      'conv_roles','user','Content for role user', 'gpt-4o'),
  ('msg_role_assistant', 'conv_roles','assistant','Content for role assistant', 'gpt-4o'),
  ('msg_role_system',    'conv_roles','system','Content for role system', 'gpt-4o'),
  ('msg_role_tool',      'conv_roles','tool','Content for role tool', 'gpt-4o'),
  ('msg_role_developer', 'conv_roles','developer','Content for role developer', 'gpt-4o');

-- Seed platform variation messages
INSERT INTO message(id, conversation_id, role, content, platform, model)
VALUES
  ('msg_platform_web',         'conv_platform','user','Content for platform web','web', 'gpt-4o'),
  ('msg_platform_mobile',      'conv_platform','user','Content for platform mobile','mobile', 'gpt-4o'),
  ('msg_platform_api',         'conv_platform','user','Content for platform api','api', 'gpt-4o'),
  ('msg_platform_dynamic_apps','conv_platform','user','Content for platform dynamic-apps','dynamic-apps', 'gpt-4o');

-- Seed mode variation messages
INSERT INTO message(id, conversation_id, role, content, mode, model)
VALUES
  ('msg_mode_normal',     'conv_mode','user','Content for mode normal','normal', 'gpt-4o'),
  ('msg_mode_local',      'conv_mode','user','Content for mode local','local', 'gpt-4o'),
  ('msg_mode_remote',     'conv_mode','user','Content for mode remote','remote', 'gpt-4o'),
  ('msg_mode_prompt_coach','conv_mode','user','Content for mode prompt_coach','prompt_coach', 'gpt-4o'),
  ('msg_mode_no_system',  'conv_mode','user','Content for mode no_system','no_system', 'gpt-4o');

-- Seed status variation messages
INSERT INTO message(id, conversation_id, role, content, status, model)
VALUES
  ('msg_status_pending',   'conv_status','assistant','Content with status pending','pending', 'gpt-4o'),
  ('msg_status_error',     'conv_status','assistant','Content with status error','error', 'gpt-4o'),
  ('msg_status_completed', 'conv_status','assistant','Content with status completed','completed', 'gpt-4o');

-- Seed timestamp ordering messages
INSERT INTO message(id, conversation_id, role, content, timestamp, model)
VALUES
  ('msg_ts_old','conv_ts','assistant','Old timestamp message', 1000, 'gpt-4o'),
  ('msg_ts_new','conv_ts','assistant','New timestamp message', 2000, 'gpt-4o');

-- Seed threaded, system, developer, tool messages
INSERT INTO message(id, conversation_id, role, content, model)
VALUES
  ('msg_system',   'conv_threads','system','System-level instructions', 'gpt-4o'),
  ('msg_developer','conv_threads','developer','Developer-specified guidance', 'gpt-4o');

INSERT INTO message(id, conversation_id, role, content, tool_calls, citations, model)
VALUES
  ('msg_tool',  'conv_threads','tool','Tool-generated output','[{"name":"toolX","args":{"param1":123}}]','[{"citation":"ref_tool"}]', 'gpt-4o');

-- Threaded messages
INSERT INTO message(id, conversation_id, role, content, timestamp, model)
VALUES
  ('msg_thread_parent','conv_threads','user','Parent message for threading',strftime('%s','now')*1000, 'gpt-4o');
INSERT INTO message(id, conversation_id, parent_message_id, role, content, model)
VALUES
  ('msg_thread_child_1','conv_threads','msg_thread_parent','user','Thread child 1', 'gpt-4o'),
  ('msg_thread_child_2','conv_threads','msg_thread_parent','assistant','Thread child 2', 'gpt-4o'),
  ('msg_thread_child_3','conv_threads','msg_thread_parent','user','Thread child 3', 'gpt-4o');

-- Seed citation-only message
INSERT INTO message(id, conversation_id, role, content, citations, model)
VALUES ('msg_citations','conv_citations','assistant','Here is a citation','[{"citation":"http://example.com","text":"Example Domain"}]', 'gpt-4o');

-- Seed attachments messages
INSERT INTO message(id, conversation_id, role, content, data, model)
VALUES
  ('msg_attachment_image','conv_attachments','assistant','Image below:', '{"attachments":[{"type":"image","url":"http://example.com/image.png"}]}', 'gpt-4o'),
  ('msg_attachment_doc','conv_attachments','assistant','Document attached:', '{"attachments":[{"type":"document","url":"http://example.com/doc.pdf","name":"Doc","isMarkdown":false}]}', 'gpt-4o');

-- Seed search grounding message
INSERT INTO message(id, conversation_id, role, content, data, model)
VALUES ('msg_search_grounding','conv_search_grounding','assistant','Search grounding test', '{"searchGrounding":{"webSearchQueries":["hello world"],"groundingChunks":[{"web":{"uri":"http://example.com","title":"Example"}}]}}', 'gpt-4o');

-- Seed custom XML & code fence message
INSERT INTO message(id, conversation_id, role, content, model)
VALUES ('msg_custom_xml_code','conv_custom_xml_code','assistant','<note>Pay attention</note>\n```\nconst x = 1;\n```', 'gpt-4o');

-- Seed analysis & think tag messages
INSERT INTO message(id, conversation_id, role, content, model)
VALUES
  ('msg_analysis_closed','conv_analysis','assistant','Intro text<analysis>Closed analysis content</analysis>End text', 'gpt-4o'),
  ('msg_analysis_stream','conv_analysis','assistant','Streaming start<analysis>Partial analysis', 'gpt-4o');

INSERT INTO message(id, conversation_id, role, content, model)
VALUES
  ('msg_think_closed','conv_think','assistant','<think>Closed think content</think>Answer part', 'gpt-4o'),
  ('msg_think_stream','conv_think','assistant','<think>Streaming thinking...', 'gpt-4o');

-- Seed artifact tag messages
INSERT INTO message(id, conversation_id, role, content, model)
VALUES
  ('msg_artifact_closed','conv_artifact','assistant','Here is code:<artifact identifier="code1" type="code" language="javascript" title="Example">console.log("hi");</artifact>', 'gpt-4o'),
  ('msg_artifact_stream','conv_artifact','assistant','Streaming artifact:<artifact identifier="stream1" type="code">partial code', 'gpt-4o');

-- Seed external function call message
INSERT INTO message(id, conversation_id, role, name, content, tool_calls, model)
VALUES ('msg_external_function','conv_external_function','assistant','External Functions','External function output','[{"name":"extFunc","arguments":{"param":42}}]', 'gpt-4o');

-- Seed full search grounding + markdown attachment
INSERT INTO message(id, conversation_id, role, content, data, model)
VALUES ('msg_search_grounding_full','conv_search_grounding_full','assistant','Grounding and attachment test', '{"searchGrounding":{"webSearchQueries":["query1","query2"],"groundingChunks":[{"web":{"uri":"http://example.com/1","title":"One"}},{"web":{"uri":"http://example.com/2","title":"Two"}}],"groundingSupports":[{"segment":{"startIndex":0,"endIndex":5,"text":"Examp"},"groundingChunkIndices":[0],"confidenceScores":[0.85]}]},"attachments":[{"type":"document","url":"http://example.com/doc.md","name":"DocMD","isMarkdown":true}]}', 'gpt-4o');

-- Seed ResponseRenderer test messages
INSERT INTO message(id, conversation_id, role, name, content, data, model)
VALUES
  ('msg_renderer_text','conv_renderer','tool','ToolText','Tool text response','{"formattedName":"ToolText","responseType":"text","result":"Simple text output"}', 'gpt-4o'),
  ('msg_renderer_json','conv_renderer','tool','ToolJSON','Tool JSON response','{"formattedName":"ToolJSON","responseType":"json","result":{"foo":"bar","baz":123}}', 'gpt-4o'),
  ('msg_renderer_table','conv_renderer','tool','ToolTable','Tool Table response','{"formattedName":"ToolTable","responseType":"table","responseDisplay":{"fields":[{"key":"col1","label":"Column 1"},{"key":"col2","label":"Column 2"}]},"results":[{"col1":"r1c1","col2":"r1c2"},{"col1":"r2c1","col2":"r2c2"}]}', 'gpt-4o'),
  ('msg_renderer_template','conv_renderer','tool','ToolTemplate','Tool Template response','{"formattedName":"ToolTemplate","responseType":"template","responseDisplay":{"template":"Hello, {name}!"},"result":{"name":"Alice"}}', 'gpt-4o'),
  ('msg_renderer_custom','conv_renderer','tool','ToolCustom','Custom view response','{"formattedName":"ToolCustom","foo":"bar"}', 'gpt-4o');

-- Seed messages for a React artifact
INSERT INTO message(id, conversation_id, role, content, model, timestamp, platform, mode, log_id)
VALUES
  ('msg_artifact_react_user', 'conv_artifact_react', 'user', 'Create an interactive React component to teach linear equations.', 'o1', 1742599132734, 'web', 'normal', NULL),
  ('msg_artifact_react_assistant', 'conv_artifact_react', 'assistant', '<analysis>
The user has asked for a React component that helps teach linear equations interactively. Below is a more extensive code example that includes user inputs for the slope (m) and intercept (b), a simple graph rendered with SVG, and interactive table values. This is wrapped in an artifact because the code is more than 15 lines and is self-contained.
</analysis>

<answer>
Below is an example of an interactive React component that you can use or adapt to teach students about linear equations. Once you create a new React project, you can place this code in a file (for example, "LinearEquationTutor.jsx") and import it into your main application.

<artifact identifier="react-linear-equation-tutor" type="application/code" language="jsx" title="Interactive Linear Equations React Component">
import React, { useState } from ''react'';

function LinearEquationTutor() {
  const [slope, setSlope] = useState(1);
  const [intercept, setIntercept] = useState(0);
  
  // Generate some table data for the chosen slope (m) and intercept (b).
  const generateData = () => {
    let dataPoints = [];
    for (let x = -5; x <= 5; x++) {
      const y = slope * x + intercept;
      dataPoints.push({ x, y });
    }
    return dataPoints;
  };

  const data = generateData();

  // SVG Plot settings
  const width = 300;
  const height = 300;
  const originX = width / 2;
  const originY = height / 2;
  const unitsPerPixel = 10;

  // Convert coordinate space to pixels for an (x, y) point
  const toPixelCoords = (x, y) => {
    return {
      px: originX + x * unitsPerPixel,
      py: originY - y * unitsPerPixel
    };
  };

  return (
    <div style={{ fontFamily: ''Arial, sans-serif'', maxWidth: ''600px'', margin: ''0 auto'' }}>
      <h2>Interactive Linear Equation Tutor</h2>
      <p>Adjust the slope (m) and intercept (b) to see how it affects the line y = m·x + b.</p>
      
      <div style={{ display: ''flex'', gap: ''20px'', marginBottom: ''20px'' }}>
        <label>
          Slope (m): 
          <input
            type="number"
            step="0.1"
            value={slope}
            onChange={(e) => setSlope(Number(e.target.value))}
            style={{ marginLeft: ''5px'' }}
          />
        </label>
        <label>
          Intercept (b):
          <input
            type="number"
            step="0.1"
            value={intercept}
            onChange={(e) => setIntercept(Number(e.target.value))}
            style={{ marginLeft: ''5px'' }}
          />
        </label>
      </div>

      <h3>Equation:</h3>
      <p>y = {slope}x + {intercept}</p>

      <svg width={width} height={height} style={{ border: ''1px solid #ccc'' }}>
        {/* Draw axes */}
        <line x1={0} y1={originY} x2={width} y2={originY} stroke="black"/>
        <line x1={originX} y1={0} x2={originX} y2={height} stroke="black"/>
        
        {/* Draw data points for x from -5 to 5 */}
        {data.map((point, index) => {
          const { px, py } = toPixelCoords(point.x, point.y);
          return (
            <circle key={index} cx={px} cy={py} r={3} fill="blue" />
          );
        })}
      </svg>

      <h3>Data Table (x, y):</h3>
      <table cellPadding="8" style={{ borderCollapse: ''collapse'' }}>
        <thead>
          <tr>
            <th style={{ borderBottom: ''1px solid #000'' }}>x</th>
            <th style={{ borderBottom: ''1px solid #000'' }}>y</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point, index) => (
            <tr key={index}>
              <td style={{ borderBottom: ''1px solid #ccc'' }}>{point.x}</td>
              <td style={{ borderBottom: ''1px solid #ccc'' }}>{point.y}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LinearEquationTutor;
</artifact>

Try including this component in your React app by importing and rendering <LinearEquationTutor /> in your main application file (e.g., App.jsx). You can expand this code with additional hints, quizzes, or visual embellishments to enhance the learning experience.
</answer>', 'o1', 1742599133253, 'web', 'normal', '01JPXG15X8WMGCAK3X8WK1JX88');
